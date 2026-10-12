import type { CardDetail } from "../../domain/model";
import type { ToolContext } from "../context";

export const MAX_SLUGS = 5;

export type GetCardResult =
  | { kind: "bad-count"; count: number }
  | { kind: "missing"; slugs: string[] }
  | { kind: "found"; cards: CardDetail[] };

// 同じ slug は 1 回だけ返す。1 枚でも無ければ、どれも返さない
export function getCard(ctx: ToolContext, slugs: string[]): GetCardResult {
  if (slugs.length < 1 || slugs.length > MAX_SLUGS) {
    return { kind: "bad-count", count: slugs.length };
  }
  const unique = [...new Set(slugs)];
  const cards = unique.map((s) => ctx.cards.readDetail(s));
  const missing = unique.filter((_, i) => cards[i] === null);
  if (missing.length > 0) return { kind: "missing", slugs: missing };
  return { kind: "found", cards: cards.filter((c) => c !== null) };
}
