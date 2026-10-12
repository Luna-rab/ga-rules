import type { ClauseHit, RulingHit } from "../../domain/model";
import { searchWords } from "../../domain/search-terms";
import type { ToolContext } from "../context";

export const CLAUSE_LIMIT = 7;
export const RULING_LIMIT = 3;

export type SearchRulesResult =
  | { kind: "no-words" }
  | { kind: "found"; clauses: ClauseHit[]; rulings: RulingHit[] };

export function searchRules(ctx: ToolContext, query: string): SearchRulesResult {
  const words = searchWords(query);
  if (words === null) return { kind: "no-words" };
  return {
    kind: "found",
    clauses: ctx.rules.searchClauses(words, CLAUSE_LIMIT),
    rulings: ctx.rules.searchRulings(words, RULING_LIMIT),
  };
}
