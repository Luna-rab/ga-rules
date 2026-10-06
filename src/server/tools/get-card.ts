import { z } from "zod";
import { readCardDetail } from "../read/cards";
import { renderCardDetail } from "../render/cards";
import type { ToolDefinition } from "./types";

const MAX_SLUGS = 5;

export const getCard: ToolDefinition<{ slugs: z.ZodArray<z.ZodString> }> = {
  name: "get_card",
  description:
    "Returns full details of 1 to 5 Grand Archive cards by exact slug: stored fields, all rulings with [cite_id], terms, referenced cards, and rules clauses that mention the card name. Get slugs from find_cards or search_cards.",
  inputSchema: { slugs: z.array(z.string()) },
  handler: (ctx, { slugs }) => {
    if (slugs.length < 1 || slugs.length > MAX_SLUGS) {
      return {
        text: `Pass 1 to ${MAX_SLUGS} slugs per call (got ${slugs.length}).`,
        isError: true,
        count: 0,
      };
    }
    const unique = [...new Set(slugs)];
    const cards = unique.map((s) => readCardDetail(ctx.db, s));
    const missing = unique.filter((_, i) => cards[i] === null);
    if (missing.length > 0) {
      return {
        text: `No card with slug: ${missing.join(", ")}. Find slugs with find_cards (by name) or search_cards.`,
        isError: true,
        count: 0,
      };
    }
    const found = cards.filter((c) => c !== null);
    return { text: found.map(renderCardDetail).join("\n\n---\n\n"), count: found.length };
  },
};
