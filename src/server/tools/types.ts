import type { z } from "zod";
import type { ToolContext } from "../context";

export type ToolOutput = { text: string; isError?: boolean; count: number };

export type ToolDefinition<S extends z.ZodRawShape> = {
  name: string;
  description: string;
  inputSchema: S;
  handler: (ctx: ToolContext, args: z.infer<z.ZodObject<S>>) => ToolOutput;
};
