import { Database } from "bun:sqlite";
import { type Catalog, loadCatalog } from "./read/catalog";

export type ToolContext = { db: Database; catalog: Catalog };

// 索引を読み取り専用で開き、変わらないデータを catalog に読む。
export function openContext(indexPath: string): ToolContext {
  const db = new Database(indexPath, { readonly: true, strict: true });
  return { db, catalog: loadCatalog(db) };
}
