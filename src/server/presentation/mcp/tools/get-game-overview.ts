import type { z } from "zod";
import { getGameOverview as run } from "../../../application/usecases/get-game-overview";
import { renderGameOverview } from "../../markdown/overview";
import type { ToolDefinition } from "./types";

export const getGameOverview: ToolDefinition<z.ZodRawShape> = {
  name: "get_game_overview",
  description:
    "Returns an overview of the Grand Archive TCG: what the game is, terms easily confused with other card games, excerpts of the core rules, and the table of contents of the rules documents. Call this first whenever the topic is Grand Archive.",
  inputSchema: {},
  handler: (ctx) => {
    const overview = run(ctx);
    return {
      text: renderGameOverview(overview, ctx.catalog.ruleUrls),
      count: overview.overview.length,
    };
  },
};
