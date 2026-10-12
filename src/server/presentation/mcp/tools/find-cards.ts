import { z } from "zod";
import { findCards as run, MAX_NAME_LENGTH } from "../../../application/usecases/find-cards";
import { MAX_CANDIDATES } from "../../../domain/card-name";
import { renderCardLine } from "../../markdown/cards";
import type { ToolDefinition } from "./types";

export const findCards: ToolDefinition<{ name: z.ZodString }> = {
  name: "find_cards",
  description: `Finds Grand Archive cards whose names resemble the given name (tolerates typos and partial names). Returns up to ${MAX_CANDIDATES} candidates, one per line, with slug. Back faces of double-faced cards have their own slug and are marked "back face of <front slug>". Use the slug with get_card.`,
  inputSchema: { name: z.string() },
  handler: (ctx, { name }) => {
    const result = run(ctx, name);
    switch (result.kind) {
      case "name-too-long":
        return {
          text: `name is too long (${result.length} characters). Give a card name or part of one, at most ${MAX_NAME_LENGTH} characters.`,
          isError: true,
          count: 0,
        };
      case "no-words":
        return {
          text: "name has no letters or digits. Give a card name or part of one.",
          isError: true,
          count: 0,
        };
    }
    const { cards, total } = result;
    if (cards.length === 0) return { text: "No cards found.", count: 0 };
    const lines = cards.map((c) => renderCardLine(c));
    if (total > cards.length) {
      lines.push(
        `Showing ${cards.length} of ${total} matches. Make the name more specific, or narrow with search_cards.`,
      );
    }
    return { text: lines.join("\n"), count: cards.length };
  },
};
