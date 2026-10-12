import type { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ToolContext } from "../../application/context";
import { createToolContext } from "../../compose";
import { openIndexDatabase } from "../../infrastructure/sqlite/open";

const DEFAULT_INDEX = fileURLToPath(new URL("../../../../index.sqlite", import.meta.url));

// テストがツールの出力を索引と突き合わせられるよう、db も渡す
export type TestContext = ToolContext & { db: Database };

// サーバーのテストが実データの索引を開く。無ければ飛ばさずに失敗させる。
export function openTestContext(): TestContext {
  const indexPath = process.env.INDEX_PATH ?? DEFAULT_INDEX;
  if (!existsSync(indexPath)) {
    throw new Error(
      `索引が無い: ${indexPath}。bun run fetch:data で取得し、bun run build:index で索引を作ってから流す`,
    );
  }
  const db = openIndexDatabase(indexPath);
  return { ...createToolContext(db), db };
}
