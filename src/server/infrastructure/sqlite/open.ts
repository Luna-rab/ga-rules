import { Database } from "bun:sqlite";

export function openIndexDatabase(indexPath: string): Database {
  return new Database(indexPath, { readonly: true, strict: true });
}
