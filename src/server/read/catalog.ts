import type { Database } from "bun:sqlite";

// 欄は task2 の実装で決める。
export type Catalog = Record<string, unknown>;

export function loadCatalog(_db: Database): Catalog {
  throw new Error("未実装");
}
