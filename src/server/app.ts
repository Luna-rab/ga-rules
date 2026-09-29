import type { Database } from "bun:sqlite";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import { createMcpServer } from "./mcp";

export function createApp(db: Database): Hono {
  const app = new Hono();

  app.all("/mcp", async (c) => {
    const server = createMcpServer(db);
    const transport = new WebStandardStreamableHTTPServerTransport({
      // undefined で stateless。Cloud Run は別の台に振り分けることがあるので、セッションを持たない。
      sessionIdGenerator: undefined,
      // ツールは途中経過を送らないので、SSE ではなく JSON 1 つで返す。
      enableJsonResponse: true,
    });
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });

  return app;
}
