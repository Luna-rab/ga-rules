import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import type { ToolContext } from "./context";
import { createMcpServer } from "./mcp";
import { rateLimit, type RateLimitOptions } from "./rate-limit";

export function createApp(ctx: ToolContext, options: { rateLimit?: RateLimitOptions } = {}): Hono {
  const app = new Hono();

  if (options.rateLimit) app.use("/mcp", rateLimit(options.rateLimit));

  app.all("/mcp", async (c) => {
    const server = createMcpServer(ctx);
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
