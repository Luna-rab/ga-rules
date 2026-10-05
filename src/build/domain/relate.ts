import type { Card, Page, Ruling, Term } from "./model";

// rule をカードごとに 1 行ずつ。同じ文面でもまとめない。rulingId は 1 から
export function toRulings(_cards: Card[]): Ruling[] {
  throw new Error("not implemented");
}

export type Relations = {
  clauseTerms: { clauseId: string; termId: number }[];
  cardTerms: { cardSlug: string; termId: number }[];
  rulingTerms: { rulingId: number; termId: number }[];
  clauseCards: { clauseId: string; cardSlug: string }[];
  rulingCards: { rulingId: number; cardSlug: string }[];
  cardReferences: { fromSlug: string; toSlug: string; kind: string }[];
};

export function relate(_input: {
  pages: Page[];
  terms: Term[];
  cards: Card[];
  rulings: Ruling[];
}): Relations {
  throw new Error("not implemented");
}
