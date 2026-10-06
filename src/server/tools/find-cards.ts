import { z } from "zod";
import type { ToolDefinition } from "./types";

export const findCards: ToolDefinition<{ name: z.ZodString }> = {
  name: "find_cards",
  description:
    "Finds Grand Archive cards whose names resemble the given name (tolerates typos and partial names). Returns up to 10 candidates, one per line, with slug. Use the slug with get_card.",
  inputSchema: { name: z.string() },
  handler: () => ({ text: "Not implemented yet.", isError: true, count: 0 }),
};
