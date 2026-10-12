import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";

// domain/ と presentation/markdown/ から DB の import を禁じる .oxlintrc.json の設定を、実際に oxlint を流して確かめる。
// 一時ファイルが残ると bun run lint が落ちるので、成否にかかわらず必ず消す。

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

type Dir = "domain" | "presentation/markdown" | "infrastructure/sqlite" | "presentation/mcp/tools";

const CATALOG = "infrastructure/sqlite/catalog-loader";

function catalogImport(dir: Dir): string {
  const spec = relative(dir, CATALOG);
  return `import { loadCatalog } from "${spec.startsWith(".") ? spec : `./${spec}`}";\nexport const used = loadCatalog;\n`;
}

const FORBIDDEN: { label: string; code: (dir: Dir) => string }[] = [
  {
    label: "bun:sqlite",
    code: () => 'import { Database } from "bun:sqlite";\nexport const used = Database;\n',
  },
  {
    label: "drizzle-orm",
    code: () => 'import { sql } from "drizzle-orm";\nexport const used = sql;\n',
  },
  {
    label: "drizzle-orm/sqlite-core",
    code: () =>
      'import { sqliteTable } from "drizzle-orm/sqlite-core";\nexport const used = sqliteTable;\n',
  },
  { label: CATALOG, code: catalogImport },
];

function lintProbe(dir: Dir, code: string): { exitCode: number; output: string } {
  const abs = `${ROOT}src/server/${dir}`;
  const createdDir = !existsSync(abs);
  // 名前を毎回変える。同じ名前だと、同時に流れた別の実行が finally で消し、oxlint が空振りして通る
  const rel = `src/server/${dir}/__lint_boundary_probe_${crypto.randomUUID()}__.ts`;
  try {
    mkdirSync(abs, { recursive: true });
    writeFileSync(`${ROOT}${rel}`, code);
    const proc = Bun.spawnSync(["bunx", "oxlint", rel], {
      cwd: ROOT,
      stdout: "pipe",
      stderr: "pipe",
    });
    return {
      exitCode: proc.exitCode,
      output: `${proc.stdout.toString()}${proc.stderr.toString()}`,
    };
  } finally {
    rmSync(`${ROOT}${rel}`, { force: true });
    if (createdDir) rmSync(abs, { recursive: true, force: true });
  }
}

describe("domain/・presentation/markdown/ の import の境界", () => {
  for (const dir of ["domain", "presentation/markdown"] as const) {
    for (const { label, code } of FORBIDDEN) {
      test(`${dir}/ で ${label} を import すると oxlint が no-restricted-imports で落ちる`, () => {
        const { exitCode, output } = lintProbe(dir, code(dir));
        expect(exitCode).not.toBe(0);
        expect(output).toContain("no-restricted-imports");
      }, 30_000);
    }
  }

  for (const { label, code } of FORBIDDEN.filter((f) => f.label !== CATALOG)) {
    test(`infrastructure/sqlite/ で ${label} を import しても oxlint は通る`, () => {
      const { exitCode, output } = lintProbe(
        "infrastructure/sqlite",
        code("infrastructure/sqlite"),
      );
      expect({ exitCode, output }).toMatchObject({ exitCode: 0 });
    }, 30_000);
  }

  for (const { label, code } of FORBIDDEN) {
    test(`presentation/mcp/tools/ で ${label} を import しても oxlint は通る`, () => {
      const { exitCode, output } = lintProbe(
        "presentation/mcp/tools",
        code("presentation/mcp/tools"),
      );
      expect({ exitCode, output }).toMatchObject({ exitCode: 0 });
    }, 30_000);
  }
});
