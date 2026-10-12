import { findSimilarCards, nameWords } from "../../domain/card-name";
import type { CardSummary } from "../../domain/model";
import type { ToolContext } from "../context";

// 編集距離を全カードと取るので、カード名より明らかに長い入力は比べない。
export const MAX_NAME_LENGTH = 100;

export type FindCardsResult =
  | { kind: "name-too-long"; length: number }
  | { kind: "no-words" }
  // total は似ている名前の総数。cards はそのうち類似度の高い順の先頭
  | { kind: "found"; cards: CardSummary[]; total: number };

export function findCards(ctx: ToolContext, name: string): FindCardsResult {
  if (name.length > MAX_NAME_LENGTH) return { kind: "name-too-long", length: name.length };
  if (nameWords(name).length === 0) return { kind: "no-words" };
  const found = findSimilarCards(name, ctx.catalog.cards);
  const cards = ctx.cards.readSummaries(found.cards.map((c) => c.slug));
  return { kind: "found", cards, total: found.total };
}
