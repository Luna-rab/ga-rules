import { z } from "zod";
import { MAX_SLUGS, getCard as run } from "../../../application/usecases/get-card";
import { renderCardDetail } from "../../markdown/cards";
import type { ToolDefinition } from "./types";

export const getCard: ToolDefinition<{ slugs: z.ZodArray<z.ZodString> }> = {
  name: "get_card",
  description:
    "Returns full details of 1 to 5 Grand Archive cards by exact slug: stored fields, all rulings with [cite_id], terms, referenced cards, and rules clauses that mention the card name. ERRATA that reword the effect text are already applied to it; ERRATA rulings record what changed. For a double-faced card, the front's details include its back face; a back face's slug returns the back face with the front's rulings. Get slugs from find_cards or search_cards.",
  inputSchema: { slugs: z.array(z.string()) },
  handler: (ctx, { slugs }) => {
    const result = run(ctx, slugs);
    switch (result.kind) {
      case "bad-count":
        return {
          text: `Pass 1 to ${MAX_SLUGS} slugs per call (got ${result.count}).`,
          isError: true,
          count: 0,
        };
      case "missing":
        return {
          text: `No card with slug: ${result.slugs.join(", ")}. Find slugs with find_cards (by name) or search_cards.`,
          isError: true,
          count: 0,
        };
    }
    return {
      text: result.cards.map((c) => renderCardDetail(c, ctx.catalog.ruleUrls)).join("\n\n---\n\n"),
      count: result.cards.length,
    };
  },
};
