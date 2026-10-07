import { applyCardCorrections, applyRulingCorrections, CORRECTIONS } from "./domain/corrections";
import { assertErrataApplied } from "./domain/errata";
import { relate, toRulings } from "./domain/relate";
import { parseRules } from "./domain/rules";
import { assertOverviewPages, parseToc } from "./domain/rules/toc";
import { assertTermSources, extractTerms } from "./domain/terms";
import { DATA_DIR } from "./infra/fetch/data-dir";
import { writeIndex } from "./infra/index-writer";
import { readCards, readRules, readSummary } from "./infra/raw-store";

// readRules/readCards/readSummary → applyCardCorrections → parseRules → assertOverviewPages → parseToc → extractTerms → assertTermSources → toRulings → applyRulingCorrections → assertErrataApplied → relate → writeIndex
// DataError は writeIndex より前に投げられるので、outPath には何も書かない。
export async function buildIndex(opts: { dataDir: string; outPath: string }): Promise<void> {
  const [rawPages, rawCards, summary] = await Promise.all([
    readRules(opts.dataDir),
    readCards(opts.dataDir),
    readSummary(opts.dataDir),
  ]);
  const cards = applyCardCorrections(rawCards, CORRECTIONS);
  const pages = parseRules(rawPages, CORRECTIONS);
  assertOverviewPages(pages);
  const toc = parseToc(summary, pages);
  const terms = extractTerms(pages);
  assertTermSources(pages, terms);
  const rulings = applyRulingCorrections(toRulings(cards), CORRECTIONS);
  assertErrataApplied(cards, rulings);
  const relations = relate({ pages, terms, cards, rulings });
  await writeIndex(opts.outPath, { pages, toc, terms, cards, rulings, relations });
}

// 使い方: bun run build:index [出力先]
if (import.meta.main) {
  const outPath = process.argv[2] ?? "index.sqlite";
  await buildIndex({ dataDir: DATA_DIR, outPath });
  console.log(`wrote ${outPath}`);
}
