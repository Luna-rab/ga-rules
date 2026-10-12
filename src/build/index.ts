import { termKeys } from "../shared/infrastructure/nlp/compromise-inflector";
import { buildIndex } from "./application/build-index";
import { DATA_DIR } from "./infrastructure/fetch/data-dir";
import { createFileRawSource } from "./infrastructure/raw-store/file-raw-source";
import { createSqliteIndexWriter } from "./infrastructure/sqlite/index-writer";

// data/ と同じ構成のディレクトリを読み、outPath に index.sqlite を書く
export function buildIndexFromFiles(opts: { dataDir: string; outPath: string }): Promise<void> {
  return buildIndex({
    source: createFileRawSource(opts.dataDir),
    writer: createSqliteIndexWriter(opts.outPath),
    termKey: termKeys.termKey,
  });
}

// 使い方: bun run build:index [出力先]
if (import.meta.main) {
  const outPath = process.argv[2] ?? "index.sqlite";
  await buildIndexFromFiles({ dataDir: DATA_DIR, outPath });
  console.log(`wrote ${outPath}`);
}
