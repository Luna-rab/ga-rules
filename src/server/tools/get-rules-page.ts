import { z } from "zod";
import type { ToolDefinition } from "./types";

export const getRulesPage: ToolDefinition<{ page_id: z.ZodString }> = {
  name: "get_rules_page",
  description:
    "Returns a whole Grand Archive rules page, every clause prefixed with its [clause_id]. Accepts a page_id, or a clause ID from search_rules (the part after # is ignored). The glossary pages return a list of term names; use get_term for those.",
  inputSchema: { page_id: z.string() },
  handler: () => ({ text: "Not implemented yet.", isError: true, count: 0 }),
};
