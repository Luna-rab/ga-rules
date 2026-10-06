import { z } from "zod";
import type { ToolDefinition } from "./types";

export const getCard: ToolDefinition<{ slugs: z.ZodArray<z.ZodString> }> = {
  name: "get_card",
  description:
    "Returns full details of 1 to 5 Grand Archive cards by exact slug: stored fields, all rulings with [cite_id], terms, referenced cards, and rules clauses that mention the card name. Get slugs from find_cards or search_cards.",
  inputSchema: { slugs: z.array(z.string()) },
  handler: () => ({ text: "Not implemented yet.", isError: true, count: 0 }),
};
