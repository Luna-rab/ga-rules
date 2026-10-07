import { looseKey, TERM_SYNONYMS, termKey } from "../../shared/term-key";

// 本文の代わりに用語名の一覧を返す用語集のページ（get_term で引く）
export const GLOSSARY_PAGE_IDS: readonly string[] = ["keywords-and-abilities", "game-terms"];

type TermLike = {
  name: string;
  aliases: string[];
  definitions: { pageId: string; sectionId: string | null }[];
};

// 用語集のページの節に定義を持つ用語の名前。目次の順ではなく catalog の順
export function glossaryTermNames(terms: TermLike[], pageId: string): string[] {
  return terms
    .filter((t) => t.definitions.some((d) => d.pageId === pageId && d.sectionId !== null))
    .map((t) => t.name);
}

// 2 語以上に当たったら、呼び出し側が候補として示せるよう全部返す
export function findTerms<T extends TermLike>(terms: T[], input: string): T[] {
  if (input.trim() === "") return [];
  const whole = findByKeys(terms, input);
  if (whole.length > 0 || !input.includes("/")) return whole;
  return [...new Set(input.split("/").flatMap((part) => findByKeys(terms, part)))];
}

function findByKeys<T extends TermLike>(terms: T[], input: string): T[] {
  if (input.trim() === "") return [];
  const key = termKey(input);
  const exact = terms.filter((t) => [t.name, ...t.aliases].some((f) => termKey(f) === key));
  if (exact.length > 0) return exact;

  const loose = looseKey(input);
  const near = terms.filter((t) => [t.name, ...t.aliases].some((f) => looseKey(f) === loose));
  if (near.length > 0) return near;

  const target = Object.entries(TERM_SYNONYMS).find(([word]) => looseKey(word) === loose)?.[1];
  return terms.filter((t) => t.name === target);
}

// どの用語の定義でもない節（用語集のページの冒頭の一般則など）。一覧だけでは届かないので本文を返す
export function generalSections<S extends { sectionId: string }>(
  terms: TermLike[],
  pageId: string,
  sections: S[],
): S[] {
  const defined = new Set(
    terms.flatMap((t) => t.definitions.filter((d) => d.pageId === pageId).map((d) => d.sectionId)),
  );
  return sections.filter((s) => !defined.has(s.sectionId));
}
