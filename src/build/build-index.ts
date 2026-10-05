import { applyCardCorrections, CORRECTIONS } from "./domain/corrections";
import { relate, toRulings } from "./domain/relate";
import { parseRules } from "./domain/rules";
import { extractTerms } from "./domain/terms";
import { DATA_DIR } from "./infra/fetch/data-dir";
import { writeIndex } from "./infra/index-writer";
import { readCards, readRules } from "./infra/raw-store";

// readRules/readCards → applyCardCorrections → parseRules → extractTerms → toRulings → relate → writeIndex
// DataError は writeIndex より前に投げられるので、outPath には何も書かない。
export async function buildIndex(opts: { dataDir: string; outPath: string }): Promise<void> {
  const [rawPages, rawCards] = await Promise.all([
    readRules(opts.dataDir),
    readCards(opts.dataDir),
  ]);
  const cards = applyCardCorrections(rawCards, CORRECTIONS);
  const pages = parseRules(rawPages, CORRECTIONS);
  const terms = extractTerms(pages);
  const rulings = toRulings(cards);
  const relations = relate({ pages, terms, cards, rulings });
  await writeIndex(opts.outPath, { pages, terms, cards, rulings, relations });
}

// 使い方: bun run build:index [出力先]
if (import.meta.main) {
  const outPath = process.argv[2] ?? "index.sqlite";
  await buildIndex({ dataDir: DATA_DIR, outPath });
  console.log(`wrote ${outPath}`);
}
