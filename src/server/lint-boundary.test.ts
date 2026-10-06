import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// lookup/ と render/ から DB の import を禁じる .oxlintrc.json の設定を、実際に oxlint を流して確かめる。
// 一時ファイルが残ると bun run lint が落ちるので、成否にかかわらず必ず消す。

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROBE = "__lint_boundary_probe__.ts";

const FORBIDDEN: { label: string; code: string }[] = [
  {
    label: "bun:sqlite",
    code: 'import { Database } from "bun:sqlite";\nexport const used = Database;\n',
  },
  { label: "drizzle-orm", code: 'import { sql } from "drizzle-orm";\nexport const used = sql;\n' },
  {
    label: "drizzle-orm/sqlite-core",
    code: 'import { sqliteTable } from "drizzle-orm/sqlite-core";\nexport const used = sqliteTable;\n',
  },
  {
    label: "../read/catalog",
    code: 'import { loadCatalog } from "../read/catalog";\nexport const used = loadCatalog;\n',
  },
];

type Dir = "lookup" | "render" | "read" | "tools";

function lintProbe(dir: Dir, code: string): { exitCode: number; output: string } {
  const abs = `${ROOT}src/server/${dir}`;
  const createdDir = !existsSync(abs);
  const rel = `src/server/${dir}/${PROBE}`;
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

describe("lookup/・render/ の import の境界", () => {
  for (const dir of ["lookup", "render"] as const) {
    for (const { label, code } of FORBIDDEN) {
      test(`${dir}/ で ${label} を import すると oxlint が no-restricted-imports で落ちる`, () => {
        const { exitCode, output } = lintProbe(dir, code);
        expect(exitCode).not.toBe(0);
        expect(output).toContain("no-restricted-imports");
      }, 30_000);
    }
  }

  for (const { label, code } of FORBIDDEN.filter((f) => f.label !== "../read/catalog")) {
    test(`read/ で ${label} を import しても oxlint は通る`, () => {
      const { exitCode, output } = lintProbe("read", code);
      expect({ exitCode, output }).toMatchObject({ exitCode: 0 });
    }, 30_000);
  }

  for (const { label, code } of FORBIDDEN) {
    test(`tools/ で ${label} を import しても oxlint は通る`, () => {
      const { exitCode, output } = lintProbe("tools", code);
      expect({ exitCode, output }).toMatchObject({ exitCode: 0 });
    }, 30_000);
  }
});
