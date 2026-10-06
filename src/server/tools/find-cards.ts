import { z } from "zod";
import { findSimilarCards, nameWords } from "../lookup/card-name";
import { readCardSummaries } from "../read/cards";
import { renderCardLine } from "../render/cards";
import type { ToolDefinition } from "./types";

export const findCards: ToolDefinition<{ name: z.ZodString }> = {
  name: "find_cards",
  description:
    "Finds Grand Archive cards whose names resemble the given name (tolerates typos and partial names). Returns up to 10 candidates, one per line, with slug. Use the slug with get_card.",
  inputSchema: { name: z.string() },
  handler: (ctx, { name }) => {
    if (nameWords(name).length === 0) {
      return {
        text: "name has no letters or digits. Give a card name or part of one.",
        isError: true,
        count: 0,
      };
    }
    const slugs = findSimilarCards(name, ctx.catalog.cards).map((c) => c.slug);
    const cards = readCardSummaries(ctx.db, slugs);
    if (cards.length === 0) return { text: "No cards found.", count: 0 };
    return { text: cards.map((c) => renderCardLine(c)).join("\n"), count: cards.length };
  },
};
