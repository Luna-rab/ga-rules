import type { Database } from "bun:sqlite";
import { termKeys } from "../shared/infrastructure/nlp/compromise-inflector";
import type { ToolContext } from "./application/context";
import { createSqliteCardRepository } from "./infrastructure/sqlite/card-repository";
import { loadCatalog } from "./infrastructure/sqlite/catalog-loader";
import { openIndexDatabase } from "./infrastructure/sqlite/open";
import { createSqliteRuleRepository } from "./infrastructure/sqlite/rule-repository";

// ツールが受け取るものを実装から組み立てる。DB や自然言語処理のライブラリを替えるときはここを直す
export function createToolContext(db: Database): ToolContext {
  return {
    rules: createSqliteRuleRepository(db),
    cards: createSqliteCardRepository(db),
    catalog: loadCatalog(db),
    termKeys,
  };
}

export function openContext(indexPath: string): ToolContext {
  return createToolContext(openIndexDatabase(indexPath));
}
