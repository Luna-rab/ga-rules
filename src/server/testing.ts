import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { openContext, type ToolContext } from "./context";

const DEFAULT_INDEX = fileURLToPath(new URL("../../index.sqlite", import.meta.url));

// サーバーのテストが実データの索引を開く。無ければ飛ばさずに失敗させる。
export function openTestContext(): ToolContext {
  const indexPath = process.env.INDEX_PATH ?? DEFAULT_INDEX;
  if (!existsSync(indexPath)) {
    throw new Error(
      `索引が無い: ${indexPath}。bun run fetch:data で取得し、bun run build:index で索引を作ってから流す`,
    );
  }
  return openContext(indexPath);
}
