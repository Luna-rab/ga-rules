import type { Database } from "bun:sqlite";
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import { FTS_TABLES_SQL } from "../../../shared/infrastructure/sqlite/fts";
import * as schema from "../../../shared/infrastructure/sqlite/schema";

// CREATE TABLE は手で書かず、スキーマと空の状態の差分として毎回作る。
export async function createTables(db: Database): Promise<void> {
  const empty = await generateSQLiteDrizzleJson({});
  const current = await generateSQLiteDrizzleJson(schema);
  const statements = await generateSQLiteMigration(empty, current);
  for (const sql of [...statements, ...FTS_TABLES_SQL]) db.run(sql);
}
