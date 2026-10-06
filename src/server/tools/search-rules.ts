import { z } from "zod";
import type { ToolDefinition } from "./types";

export const searchRules: ToolDefinition<{ query: z.ZodString }> = {
  name: "search_rules",
  description:
    "Full-text search over the Grand Archive rules and card rulings. Returns up to 7 rule clauses and 3 rulings with their [clause_id] / [cite_id]. It almost always returns something; if the top results do not answer the question, treat it as no match and tell the user nothing was found.",
  inputSchema: { query: z.string() },
  handler: () => ({ text: "Not implemented yet.", isError: true, count: 0 }),
};
