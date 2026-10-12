import { Database } from "bun:sqlite";
import { termKeys } from "../../../shared/infrastructure/nlp/compromise-inflector";
import type { ToolContext } from "../../application/context";
import { createSqliteCardRepository } from "./card-repository";
import { loadCatalog } from "./catalog-loader";
import { createSqliteRuleRepository } from "./rule-repository";

export function openIndexDatabase(indexPath: string): Database {
  return new Database(indexPath, { readonly: true, strict: true });
}

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
