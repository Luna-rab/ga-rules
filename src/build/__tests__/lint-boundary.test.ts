import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// domain/ から入出力の import を禁じる .oxlintrc.json の設定を、実際に oxlint を流して確かめる。
// 一時ファイルが残ると bun run lint が落ちるので、成否にかかわらず必ず消す。

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

const FORBIDDEN: { label: string; code: string }[] = [
  {
    label: "bun:sqlite",
    code: 'import { Database } from "bun:sqlite";\nexport const used = Database;\n',
  },
  {
    label: "node:fs",
    code: 'import { readFileSync } from "node:fs";\nexport const used = readFileSync;\n',
  },
  { label: "drizzle-orm", code: 'import { sql } from "drizzle-orm";\nexport const used = sql;\n' },
  {
    label: "drizzle-orm/sqlite-core",
    code: 'import { sqliteTable } from "drizzle-orm/sqlite-core";\nexport const used = sqliteTable;\n',
  },
  {
    label: "drizzle-kit/api",
    code: 'import { generateSQLiteMigration } from "drizzle-kit/api";\nexport const used = generateSQLiteMigration;\n',
  },
  {
    label: "../infrastructure/raw-store/file-raw-source",
    code: 'import { readRules } from "../infrastructure/raw-store/file-raw-source";\nexport const used = readRules;\n',
  },
];

function lintProbe(
  dir: "domain" | "infrastructure",
  code: string,
): { exitCode: number; output: string } {
  const abs = `${ROOT}src/build/${dir}`;
  const createdDir = !existsSync(abs);
  // 名前を毎回変える。同じ名前だと、同時に流れた別の実行が finally で消し、oxlint が空振りして通る
  const rel = `src/build/${dir}/__lint_boundary_probe_${crypto.randomUUID()}__.ts`;
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

describe("domain/ の import の境界", () => {
  for (const { label, code } of FORBIDDEN) {
    test(`domain/ で ${label} を import すると oxlint が no-restricted-imports で落ちる`, () => {
      const { exitCode, output } = lintProbe("domain", code);
      expect(exitCode).not.toBe(0);
      expect(output).toContain("no-restricted-imports");
    }, 30_000);

    test(`infrastructure/ で ${label} を import しても oxlint は通る`, () => {
      const { exitCode, output } = lintProbe("infrastructure", code);
      expect({ exitCode, output }).toMatchObject({ exitCode: 0 });
    }, 30_000);
  }

  test("domain/ で domain/ の中のモジュールを import しても oxlint は通る", () => {
    const { exitCode, output } = lintProbe(
      "domain",
      'import { DataError } from "./errors";\nimport type { Card } from "./model";\nexport const used: [typeof DataError, Card[]] = [DataError, []];\n',
    );
    expect({ exitCode, output }).toMatchObject({ exitCode: 0 });
  }, 30_000);
});
