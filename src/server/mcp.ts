import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./context";
import { logToolCall } from "./log";
import { SERVER_INSTRUCTIONS } from "./overview-text";
import { TOOLS } from "./tools";

// stateless の transport はリクエストをまたいで使い回せない。つなぐ server もリクエストごとに作る。
export function createMcpServer(ctx: ToolContext): McpServer {
  const server = new McpServer(
    { name: "ga-rules", version: "0.0.0" },
    { instructions: SERVER_INSTRUCTIONS },
  );

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      (args: Record<string, unknown>) => {
        const start = performance.now();
        const out = tool.handler(ctx, args);
        logToolCall({ tool: tool.name, args, count: out.count, ms: performance.now() - start });
        return { content: [{ type: "text" as const, text: out.text }], isError: out.isError };
      },
    );
  }

  return server;
}
