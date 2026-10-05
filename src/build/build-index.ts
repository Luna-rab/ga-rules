import { Database } from "bun:sqlite";
import { rmSync } from "node:fs";
import { createSchema } from "../shared/schema";

// 使い方: bun run build:index [出力先]
const outPath = process.argv[2] ?? "index.sqlite";

rmSync(outPath, { force: true });
const db = new Database(outPath, { create: true, strict: true });
createSchema(db);
db.close();

console.log(`wrote ${outPath}`);
