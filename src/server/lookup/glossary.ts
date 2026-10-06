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

// 名前か別名に大文字小文字を区別せず一致する用語
export function findTerm<T extends TermLike>(terms: T[], input: string): T | undefined {
  const key = input.trim().toLowerCase();
  if (key === "") return undefined;
  return terms.find(
    (t) => t.name.toLowerCase() === key || t.aliases.some((a) => a.toLowerCase() === key),
  );
}
