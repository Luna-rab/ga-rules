import { z } from "zod";
import { toMatchQuery } from "../lookup/search-terms";
import { searchClauses, searchRulings } from "../read/search";
import { renderSearchRules } from "../render/search-rules";
import type { ToolDefinition } from "./types";

export const searchRules: ToolDefinition<{ query: z.ZodString }> = {
  name: "search_rules",
  description:
    "Full-text search over the Grand Archive rules and card rulings. Returns up to 7 rule clauses and 3 rulings with their [clause_id] / [cite_id]. It almost always returns something; if the top results do not answer the question, treat it as no match and tell the user nothing was found.",
  inputSchema: { query: z.string() },
  handler: (ctx, { query }) => {
    const match = toMatchQuery(query);
    if (match === null) {
      return {
        text: 'The query has no searchable words. The rules are in English, so search with English words (letters or digits), e.g. "activate ability during opponent turn".',
        isError: true,
        count: 0,
      };
    }
    const clauses = searchClauses(ctx.db, match, 7);
    const rulings = searchRulings(ctx.db, match, 3);
    if (clauses.length + rulings.length === 0) return { text: "No results.", count: 0 };
    return { text: renderSearchRules(clauses, rulings), count: clauses.length + rulings.length };
  },
};
