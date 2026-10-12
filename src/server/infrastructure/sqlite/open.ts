import { Database } from "bun:sqlite";
import type { TermKeys } from "../../../shared/domain/term-key";
import { termKeys } from "../../../shared/infrastructure/nlp/compromise-inflector";
import { type Catalog, loadCatalog } from "./catalog-loader";

export type ToolContext = { db: Database; catalog: Catalog; termKeys: TermKeys };

export function openContext(indexPath: string): ToolContext {
  const db = new Database(indexPath, { readonly: true, strict: true });
  return { db, catalog: loadCatalog(db), termKeys };
}
