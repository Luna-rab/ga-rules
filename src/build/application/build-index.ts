import type { TermKeys } from "../../shared/domain/term-key";
import { applyCardCorrections, applyRulingCorrections, CORRECTIONS } from "../domain/corrections";
import { assertErrataApplied } from "../domain/errata";
import { relate, toRulings } from "../domain/relate";
import { parseRules } from "../domain/rules";
import { assertOverviewPages, parseToc } from "../domain/rules/toc";
import { assertTermSources, extractTerms } from "../domain/terms";
import type { IndexWriter, RawSource } from "./ports";

export type BuildIndexDeps = {
  source: RawSource;
  writer: IndexWriter;
  termKey: TermKeys["termKey"];
};

// readRules/readCards/readSummary → applyCardCorrections → parseRules → assertOverviewPages → parseToc → extractTerms → assertTermSources → toRulings → applyRulingCorrections → assertErrataApplied → relate → write
// DataError は write より前に投げられるので、書き込み先には何も書かない。
export async function buildIndex({ source, writer, termKey }: BuildIndexDeps): Promise<void> {
  const [rawPages, rawCards, summary] = await Promise.all([
    source.readRules(),
    source.readCards(),
    source.readSummary(),
  ]);
  const cards = applyCardCorrections(rawCards, CORRECTIONS);
  const pages = parseRules(rawPages, CORRECTIONS);
  assertOverviewPages(pages);
  const toc = parseToc(summary, pages);
  const terms = extractTerms(pages, termKey);
  assertTermSources(pages, terms);
  const rulings = applyRulingCorrections(toRulings(cards), CORRECTIONS);
  assertErrataApplied(cards, rulings);
  const relations = relate({ pages, terms, cards, rulings });
  await writer.write({ pages, toc, terms, cards, rulings, relations });
}
