import type { z } from "zod";
import type { ToolDefinition } from "./types";

export const getGameOverview: ToolDefinition<z.ZodRawShape> = {
  name: "get_game_overview",
  description: "",
  inputSchema: {},
  handler: () => {
    throw new Error("未実装");
  },
};
