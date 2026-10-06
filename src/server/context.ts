import type { Database } from "bun:sqlite";
import type { Catalog } from "./read/catalog";

export type ToolContext = { db: Database; catalog: Catalog };

export function openContext(_indexPath: string): ToolContext {
  throw new Error("未実装");
}
