import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";

// .oxlintrc.json の層の境界（no-restricted-imports）を、各層に試しのファイルを置いて oxlint を流して確かめる。
// 試しのファイルが残ると bun run lint が落ちるので、成否にかかわらず消す。
// oxlint は型を見るので 1 回が重い。全部のファイルを置いてから 1 回だけ流し、出力をファイルごとに分ける。

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

type Layer = "domain" | "application" | "presentation" | "infrastructure" | "domain-test" | "test";

const DIRS: { dir: string; layer: Layer }[] = [
  { dir: "src/build/domain", layer: "domain" },
  { dir: "src/server/domain", layer: "domain" },
  { dir: "src/shared/domain", layer: "domain" },
  { dir: "src/build/application", layer: "application" },
  { dir: "src/server/application", layer: "application" },
  { dir: "src/server/presentation/markdown", layer: "presentation" },
  { dir: "src/server/presentation/mcp/tools", layer: "presentation" },
  { dir: "src/build/infrastructure/sqlite", layer: "infrastructure" },
  { dir: "src/server/infrastructure/sqlite", layer: "infrastructure" },
  { dir: "src/server/domain/__tests__", layer: "domain-test" },
  { dir: "src/server/presentation/mcp/tools/__tests__", layer: "test" },
];

// from が "src/" で始まるものはリポジトリの中のモジュールで、置いたディレクトリからの相対パスにする
const IMPORTS: { label: string; from: string; name: string; blockedIn: Layer[] }[] = [
  {
    label: "bun:sqlite",
    from: "bun:sqlite",
    name: "{ Database }",
    blockedIn: ["domain", "application", "presentation", "domain-test"],
  },
  {
    label: "node:fs",
    from: "node:fs",
    name: "{ readFileSync }",
    blockedIn: ["domain", "application"],
  },
  {
    label: "drizzle-orm",
    from: "drizzle-orm",
    name: "{ sql }",
    blockedIn: ["domain", "application", "presentation", "domain-test"],
  },
  { label: "zod", from: "zod", name: "{ z }", blockedIn: ["domain", "application"] },
  {
    label: "compromise",
    from: "compromise",
    name: "nlp",
    blockedIn: ["domain", "application", "presentation"],
  },
  { label: "hono", from: "hono", name: "{ Hono }", blockedIn: ["domain", "application"] },
  {
    label: "MCP SDK",
    from: "@modelcontextprotocol/sdk/server/mcp.js",
    name: "{ McpServer }",
    blockedIn: ["domain", "application"],
  },
  {
    label: "infrastructure/logging",
    from: "src/server/infrastructure/logging/console-logger",
    name: "{ logToolCall }",
    blockedIn: ["domain", "application", "presentation"],
  },
  {
    label: "infrastructure/sqlite",
    from: "src/server/infrastructure/sqlite/open",
    name: "{ openContext }",
    blockedIn: ["domain", "application", "presentation", "domain-test"],
  },
  {
    label: "presentation",
    from: "src/server/presentation/markdown/rule-links",
    name: "{ citeLink }",
    blockedIn: ["domain", "application", "infrastructure"],
  },
  {
    label: "application",
    from: "src/server/application/usecases/search-rules",
    name: "{ CLAUSE_LIMIT }",
    blockedIn: ["domain"],
  },
  {
    label: "domain",
    from: "src/server/domain/card-query",
    name: "{ SEARCH_LIMIT }",
    blockedIn: [],
  },
];

function specifier(dir: string, from: string): string {
  if (!from.startsWith("src/")) return from;
  const rel = relative(dir, from);
  return rel.startsWith(".") ? rel : `./${rel}`;
}

// 同時に流れた別の実行と名前が重ならないよう、実行ごとに変える
const RUN = crypto.randomUUID();
const probes = DIRS.flatMap(({ dir, layer }) =>
  IMPORTS.map((imp, i) => ({
    dir,
    layer,
    imp,
    path: `${dir}/__lint_boundary_probe_${RUN}_${i}__.ts`,
  })),
);

// ファイルごとの、oxlint が出したルールの名前
let rulesByFile = new Map<string, Set<string>>();
let createdDirs: string[] = [];

beforeAll(() => {
  createdDirs = DIRS.map((d) => d.dir).filter((d) => !existsSync(`${ROOT}${d}`));
  for (const p of probes) {
    mkdirSync(`${ROOT}${p.dir}`, { recursive: true });
    writeFileSync(
      `${ROOT}${p.path}`,
      `import ${p.imp.name} from "${specifier(p.dir, p.imp.from)}";\nexport const used = [${p.imp.name.replace(/[{} ]/g, "")}];\n`,
    );
  }
  const proc = Bun.spawnSync(["bunx", "oxlint", ...probes.map((p) => p.path)], {
    cwd: ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = `${proc.stdout.toString()}${proc.stderr.toString()}`;
  rulesByFile = new Map();
  for (const m of output.matchAll(/^(\S+\.ts):\d+:\d+: \w+ [\w-]+\(([\w-]+)\)/gm)) {
    const [, file = "", rule = ""] = m;
    rulesByFile.set(file, (rulesByFile.get(file) ?? new Set()).add(rule));
  }
}, 120_000);

afterAll(() => {
  for (const p of probes) rmSync(`${ROOT}${p.path}`, { force: true });
  for (const d of createdDirs) rmSync(`${ROOT}${d}`, { recursive: true, force: true });
});

describe("層の境界", () => {
  for (const p of probes) {
    const blocked = p.imp.blockedIn.includes(p.layer);
    test(`${p.dir}/ で ${p.imp.label} を import すると ${blocked ? "no-restricted-imports で落ちる" : "通る"}`, () => {
      const rules = [...(rulesByFile.get(p.path) ?? [])];
      expect(rules).toEqual(blocked ? ["no-restricted-imports"] : []);
    });
  }
});
