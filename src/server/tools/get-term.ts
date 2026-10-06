import { z } from "zod";
import type { ToolDefinition } from "./types";

export const getTerm: ToolDefinition<{ term: z.ZodString }> = {
  name: "get_term",
  description:
    "Returns every definition of one Grand Archive term (name or alias, case-insensitive), in full, with [clause_id] on each clause. Look up one term per call.",
  inputSchema: { term: z.string() },
  handler: () => ({ text: "Not implemented yet.", isError: true, count: 0 }),
};
