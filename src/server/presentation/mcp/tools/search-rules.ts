import { z } from "zod";
import {
  CLAUSE_LIMIT,
  RULING_LIMIT,
  searchRules as run,
} from "../../../application/usecases/search-rules";
import { renderSearchRules } from "../../markdown/search-rules";
import type { ToolDefinition } from "./types";

export const searchRules: ToolDefinition<{ query: z.ZodString }> = {
  name: "search_rules",
  description: `Full-text search over the Grand Archive rules and card rulings. Returns up to ${CLAUSE_LIMIT} rule clauses and ${RULING_LIMIT} rulings with their [clause_id] / [cite_id]. It almost always returns something; if the top results do not answer the question, treat it as no match and tell the user nothing was found.`,
  inputSchema: { query: z.string() },
  handler: (ctx, { query }) => {
    const result = run(ctx, query);
    if (result.kind === "no-words") {
      return {
        text: 'The query has no searchable words. The rules are in English, so search with English words (letters or digits), e.g. "activate ability during opponent turn".',
        isError: true,
        count: 0,
      };
    }
    const { clauses, rulings } = result;
    if (clauses.length + rulings.length === 0) return { text: "No results.", count: 0 };
    return {
      text: renderSearchRules(clauses, rulings, ctx.catalog.ruleUrls),
      count: clauses.length + rulings.length,
    };
  },
};
