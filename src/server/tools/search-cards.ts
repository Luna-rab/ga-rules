import { z } from "zod";
import { parseCardQuery } from "../lookup/card-query";
import { SEARCH_LIMIT, searchCardRows } from "../read/cards";
import { renderCardLine } from "../render/cards";
import type { ToolDefinition } from "./types";

const inputSchema = {
  text: z.string().optional(),
  type: z.string().optional(),
  subtype: z.string().optional(),
  class: z.string().optional(),
  element: z.string().optional(),
  cost_type: z.string().optional(),
  speed: z.string().optional(),
  legal_in: z.string().optional(),
  banned_in: z.string().optional(),
  cost_min: z.number().optional(),
  cost_max: z.number().optional(),
  level_min: z.number().optional(),
  level_max: z.number().optional(),
  power_min: z.number().optional(),
  power_max: z.number().optional(),
  life_min: z.number().optional(),
  life_max: z.number().optional(),
  durability_min: z.number().optional(),
  durability_max: z.number().optional(),
};

export const searchCards: ToolDefinition<typeof inputSchema> = {
  name: "search_cards",
  description:
    "Searches Grand Archive cards by conditions; every condition given must hold. Returns up to 20 cards, one per line, with the total match count. text matches name or effect text (all words); type, subtype, class, element take one value each (case-insensitive); cost_type is reserve/memory/none; speed is fast/slow; legal_in and banned_in are STANDARD/PANTHEON/DRAFT; the _min/_max pairs are numeric ranges. At least one condition is required.",
  inputSchema,
  handler: (ctx, args) => {
    const parsed = parseCardQuery(args, ctx.catalog.attributes);
    if (!parsed.ok) return { text: parsed.message, isError: true, count: 0 };

    const { total, hits } = searchCardRows(ctx.db, parsed.query);
    if (hits.length === 0) return { text: "No cards found.", count: 0 };
    const header =
      total > SEARCH_LIMIT
        ? `Showing ${hits.length} of ${total} cards. Add more conditions to narrow the results.`
        : `${total} ${total === 1 ? "card" : "cards"}.`;
    const lines = hits.map((h) => renderCardLine(h.card, h.snippet?.replace(/\s+/g, " ")));
    return { text: [header, ...lines].join("\n"), count: hits.length };
  },
};
