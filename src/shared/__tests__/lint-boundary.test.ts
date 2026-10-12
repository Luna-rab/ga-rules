import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// .oxlintrc.json の層とパッケージの境界を、各ディレクトリに試しのファイルを置いて oxlint を流して確かめる。
// oxlint は型を見るので 1 回が重い。全部のファイルを置いてから 1 回だけ流し、出力をファイルごとに分ける。
// 試しのファイルが残ると bun run lint が落ちるので、終わったら消す。

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const PROBE_PREFIX = "__lint_boundary_probe_";
// テストが途中で殺されて残った試しのファイルを、次の実行で消す。同時に流れている別の実行のものは消さない
const STALE_MS = 10 * 60 * 1000;

type Pkg = "build" | "server" | "shared";
// root は src/build/・src/server/ の直下（組み立て役とコマンドの入口）
type Layer =
  | "domain"
  | "application"
  | "presentation"
  | "infrastructure"
  | "root"
  | "domain-test"
  | "test";
type Dir = { dir: string; pkg: Pkg; layer: Layer };

const DIRS: Dir[] = [
  { dir: "src/build/domain", pkg: "build", layer: "domain" },
  { dir: "src/server/domain", pkg: "server", layer: "domain" },
  { dir: "src/shared/domain", pkg: "shared", layer: "domain" },
  { dir: "src/build/application", pkg: "build", layer: "application" },
  { dir: "src/server/application", pkg: "server", layer: "application" },
  { dir: "src/server/presentation/markdown", pkg: "server", layer: "presentation" },
  { dir: "src/server/presentation/mcp/tools", pkg: "server", layer: "presentation" },
  { dir: "src/build/infrastructure/sqlite", pkg: "build", layer: "infrastructure" },
  { dir: "src/server/infrastructure/sqlite", pkg: "server", layer: "infrastructure" },
  { dir: "src/shared/infrastructure/sqlite", pkg: "shared", layer: "infrastructure" },
  { dir: "src/build", pkg: "build", layer: "root" },
  { dir: "src/server", pkg: "server", layer: "root" },
  { dir: "src/build/domain/__tests__", pkg: "build", layer: "domain-test" },
  { dir: "src/server/domain/__tests__", pkg: "server", layer: "domain-test" },
  { dir: "src/server/presentation/mcp/tools/__tests__", pkg: "server", layer: "test" },
];

const LintReport = z.object({
  diagnostics: z.array(z.object({ code: z.string(), filename: z.string() })),
  number_of_files: z.number(),
});

const RESTRICTED_IMPORT = "no-restricted-imports";
const RESTRICTED_GLOBAL = "no-restricted-globals";

type Case = { label: string; code: (dir: string) => string; rule: (d: Dir) => string | null };

function libraryCase(from: string, name: string, blockedIn: Layer[]): Case {
  return {
    label: from,
    code: () =>
      `import ${name} from "${from}";\nexport const used = [${name.replace(/[{} ]/g, "")}];\n`,
    rule: (d) => (blockedIn.includes(d.layer) ? RESTRICTED_IMPORT : null),
  };
}

// shared/ は build/・server/ を、build/ と server/ は互いを import しない。テストはこの制限の外
function crossesPackage(d: Dir, target: Pkg): boolean {
  if (d.layer === "test" || d.layer === "domain-test") return false;
  if (d.pkg === "shared") return target !== "shared";
  return target !== "shared" && target !== d.pkg;
}

// from はリポジトリの中のモジュール。置いたディレクトリからの相対パスで import する
function moduleCase(from: string, name: string, blockedIn: Layer[]): Case {
  const target = (["build", "server", "shared"] as const).find((p) => from.startsWith(`src/${p}/`));
  if (target === undefined) throw new Error(`src/ の下のパッケージではない: ${from}`);
  return {
    label: from,
    code: (dir) => {
      const rel = relative(dir, from);
      const spec = rel.startsWith(".") ? rel : `./${rel}`;
      return `import ${name} from "${spec}";\nexport const used = [${name.replace(/[{} ]/g, "")}];\n`;
    },
    rule: (d) =>
      blockedIn.includes(d.layer) || crossesPackage(d, target) ? RESTRICTED_IMPORT : null,
  };
}

function globalCase(expr: string): Case {
  return {
    label: `グローバルの ${expr}`,
    code: () => `export const used = ${expr};\n`,
    rule: (d) => (d.layer === "domain" || d.layer === "application" ? RESTRICTED_GLOBAL : null),
  };
}

const IO: Layer[] = ["domain", "application"];
const DB: Layer[] = ["domain", "application", "presentation", "domain-test"];

const CASES: Case[] = [
  libraryCase("bun:sqlite", "{ Database }", DB),
  libraryCase("bun", "{ $ }", IO),
  libraryCase("node:fs", "{ readFileSync }", IO),
  libraryCase("node:fs/promises", "{ readdir }", IO),
  libraryCase("drizzle-orm", "{ sql }", DB),
  libraryCase("drizzle-orm/sqlite-core", "{ sqliteTable }", DB),
  libraryCase("drizzle-kit/api", "{ generateSQLiteMigration }", IO),
  libraryCase("zod", "{ z }", IO),
  libraryCase("hono", "{ Hono }", IO),
  libraryCase("@modelcontextprotocol/sdk/server/mcp.js", "{ McpServer }", IO),
  libraryCase("compromise", "nlp", ["domain", "application", "presentation"]),
  moduleCase("src/server/infrastructure/logging/console-logger", "{ logToolCall }", [
    "domain",
    "application",
    "presentation",
  ]),
  moduleCase("src/server/infrastructure/sqlite/open", "{ openContext }", DB),
  moduleCase("src/server/presentation/markdown/rule-links", "{ citeLink }", [
    "domain",
    "application",
    "infrastructure",
  ]),
  moduleCase("src/server/application/usecases/search-rules", "{ CLAUSE_LIMIT }", ["domain"]),
  moduleCase("src/server/domain/card-query", "{ SEARCH_LIMIT }", []),
  moduleCase("src/build/domain/errors", "{ DataError }", []),
  moduleCase("src/shared/domain/cite", "{ pageIdOfCiteId }", []),
  globalCase("Bun.version"),
  globalCase("process.env"),
];

const RUN = crypto.randomUUID();
const probes = DIRS.flatMap((d) =>
  CASES.map((c, i) => ({ ...d, c, path: `${d.dir}/${PROBE_PREFIX}${RUN}_${i}__.ts` })),
);

// ファイルごとの、oxlint が出したルールの名前
const rulesByFile = new Map<string, Set<string>>();
let lintedFiles = 0;
let createdDirs: string[] = [];

function removeStaleProbes(): void {
  for (const { dir } of DIRS) {
    if (!existsSync(`${ROOT}${dir}`)) continue;
    for (const f of readdirSync(`${ROOT}${dir}`)) {
      const path = `${ROOT}${dir}/${f}`;
      if (f.startsWith(PROBE_PREFIX) && Date.now() - statSync(path).mtimeMs > STALE_MS) {
        rmSync(path, { force: true });
      }
    }
  }
}

beforeAll(() => {
  removeStaleProbes();
  createdDirs = DIRS.map((d) => d.dir).filter((d) => !existsSync(`${ROOT}${d}`));
  for (const p of probes) {
    mkdirSync(`${ROOT}${p.dir}`, { recursive: true });
    writeFileSync(`${ROOT}${p.path}`, p.c.code(p.dir));
  }
  const proc = Bun.spawnSync(["bunx", "oxlint", "--format=json", ...probes.map((p) => p.path)], {
    cwd: ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  const report = LintReport.parse(JSON.parse(proc.stdout.toString()));
  for (const d of report.diagnostics) {
    // code は "eslint(no-restricted-imports)" の形
    const rule = /\(([\w-]+)\)$/.exec(d.code)?.[1] ?? d.code;
    rulesByFile.set(d.filename, (rulesByFile.get(d.filename) ?? new Set()).add(rule));
  }
  lintedFiles = report.number_of_files;
}, 120_000);

afterAll(() => {
  for (const p of probes) rmSync(`${ROOT}${p.path}`, { force: true });
  for (const d of createdDirs) rmSync(`${ROOT}${d}`, { recursive: true, force: true });
});

describe("層とパッケージの境界", () => {
  // 通るはずのファイルを oxlint が読み飛ばしても、下の「通る」は通ってしまう。全部読んだことを先に確かめる
  test("oxlint が試しのファイルを全部読む", () => {
    expect(lintedFiles).toBe(probes.length);
  });

  for (const p of probes) {
    const rule = p.c.rule(p);
    test(`${p.dir}/ で ${p.c.label} を使うと ${rule ? `${rule} で落ちる` : "通る"}`, () => {
      expect([...(rulesByFile.get(p.path) ?? [])]).toEqual(rule ? [rule] : []);
    });
  }
});
