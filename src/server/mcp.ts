import type { Database } from "bun:sqlite";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// stateless の transport はリクエストをまたいで使い回せない。つなぐ server もリクエストごとに作る。
export function createMcpServer(_db: Database): McpServer {
  const server = new McpServer({ name: "ga-rules", version: "0.0.0" });
  return server;
}
