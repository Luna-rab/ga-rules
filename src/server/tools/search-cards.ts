import { z } from "zod";
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
  handler: () => ({ text: "Not implemented yet.", isError: true, count: 0 }),
};
