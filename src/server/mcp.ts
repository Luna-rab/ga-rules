import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./context";

// stateless の transport はリクエストをまたいで使い回せない。つなぐ server もリクエストごとに作る。
export function createMcpServer(_ctx: ToolContext): McpServer {
  const server = new McpServer({ name: "ga-rules", version: "0.0.0" });
  return server;
}
