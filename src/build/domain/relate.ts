import { DataError } from "./errors";
import type { Card, Page, Ruling, Term } from "./model";
import { Matcher } from "./terms";

// rule をカードごとに 1 行ずつ。同じ文面でもまとめない。rulingId は 1 から
export function toRulings(cards: Card[]): Ruling[] {
  const rulings: Ruling[] = [];
  for (const card of cards) {
    for (const r of card.rule ?? []) {
      rulings.push({
        rulingId: rulings.length + 1,
        cardSlug: card.slug,
        dateAdded: r.date_added,
        title: r.title,
        description: r.description,
      });
    }
  }
  return rulings;
}

export type Relations = {
  clauseTerms: { clauseId: string; termId: number }[];
  cardTerms: { cardSlug: string; termId: number }[];
  rulingTerms: { rulingId: number; termId: number }[];
  clauseCards: { clauseId: string; cardSlug: string }[];
  rulingCards: { rulingId: number; cardSlug: string }[];
  cardReferences: { fromSlug: string; toSlug: string; kind: string }[];
};

export function relate(input: {
  pages: Page[];
  terms: Term[];
  cards: Card[];
  rulings: Ruling[];
}): Relations {
  const termMatcher = new Matcher(
    input.terms.map((t) => ({ key: t.termId, names: [t.name, ...t.aliases] })),
  );
  // 短い名前・1 語の名前は一般語と衝突するので、2 語以上かつ 8 文字以上に限る
  const cardMatcher = new Matcher(
    input.cards
      .filter((c) => c.name.trim().split(/\s+/).length >= 2 && c.name.length >= 8)
      .map((c) => ({ key: c.slug, names: [c.name] })),
  );

  const clauseTerms = new Rows<{ clauseId: string; termId: number }>();
  const clauseCards = new Rows<{ clauseId: string; cardSlug: string }>();
  for (const page of input.pages) {
    for (const section of page.sections) {
      for (const { clauseId, text: raw } of section.clauses) {
        // リンク先（ページID#見出し）の語に当てないよう、表示文字列だけを残す
        const text = raw.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
        for (const termId of termMatcher.match(text)) clauseTerms.add({ clauseId, termId });
        for (const cardSlug of cardMatcher.match(text)) clauseCards.add({ clauseId, cardSlug });
      }
    }
  }

  const cardTerms = new Rows<{ cardSlug: string; termId: number }>();
  for (const card of input.cards) {
    if (card.effect_raw === null) continue;
    for (const termId of termMatcher.match(card.effect_raw)) {
      cardTerms.add({ cardSlug: card.slug, termId });
    }
  }

  const rulingTerms = new Rows<{ rulingId: number; termId: number }>();
  const rulingCards = new Rows<{ rulingId: number; cardSlug: string }>();
  for (const { rulingId, description } of input.rulings) {
    for (const termId of termMatcher.match(description)) rulingTerms.add({ rulingId, termId });
    for (const cardSlug of cardMatcher.match(description)) rulingCards.add({ rulingId, cardSlug });
  }

  const slugs = new Set(input.cards.map((c) => c.slug));
  const cardReferences = new Rows<{ fromSlug: string; toSlug: string; kind: string }>();
  for (const card of input.cards) {
    for (const ref of card.references ?? []) {
      if (ref.direction !== "TO") continue;
      if (!slugs.has(ref.slug)) {
        throw new DataError(card.slug, `参照先のカード ${ref.slug} が無い（kind ${ref.kind}）`);
      }
      cardReferences.add({ fromSlug: card.slug, toSlug: ref.slug, kind: ref.kind });
    }
  }

  return {
    clauseTerms: clauseTerms.rows,
    cardTerms: cardTerms.rows,
    rulingTerms: rulingTerms.rows,
    clauseCards: clauseCards.rows,
    rulingCards: rulingCards.rows,
    cardReferences: cardReferences.rows,
  };
}

// 同じ組を 2 度入れない
class Rows<T extends object> {
  readonly rows: T[] = [];
  private readonly seen = new Set<string>();

  add(row: T): void {
    const key = JSON.stringify(Object.values(row));
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.rows.push(row);
  }
}
