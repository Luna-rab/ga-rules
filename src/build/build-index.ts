import { Database } from "bun:sqlite";
import { rmSync } from "node:fs";
import { createTables } from "./infra/create-tables";

// readRules/readCards → applyCardCorrections → parseRules → extractTerms → toRulings → relate → writeIndex
export async function buildIndex(_opts: { dataDir: string; outPath: string }): Promise<void> {
  throw new Error("not implemented");
}

// 使い方: bun run build:index [出力先]
if (import.meta.main) {
  const outPath = process.argv[2] ?? "index.sqlite";

  rmSync(outPath, { force: true });
  const db = new Database(outPath, { create: true, strict: true });
  await createTables(db);
  db.close();

  console.log(`wrote ${outPath}`);
}
