import { parseCardQuery, SEARCH_LIMIT, type SearchCardsArgs } from "../../domain/card-query";
import type { CardHit } from "../../domain/model";
import type { ToolContext } from "../context";

export type SearchCardsResult =
  // message は呼び方の誤りと直し方
  | { kind: "invalid"; message: string }
  // total は条件を満たす総数。hits はそのうち先頭 limit 件
  | { kind: "found"; total: number; hits: CardHit[]; limit: number };

export function searchCards(ctx: ToolContext, args: SearchCardsArgs): SearchCardsResult {
  const parsed = parseCardQuery(args, ctx.catalog.attributes);
  if (!parsed.ok) return { kind: "invalid", message: parsed.message };
  return { kind: "found", ...ctx.cards.search(parsed.query, SEARCH_LIMIT), limit: SEARCH_LIMIT };
}
