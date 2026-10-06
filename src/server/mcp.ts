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
    // handler が例外を投げても、呼び出しログは必ず 1 行書く（SDK が例外を isError の結果にする）。
    const run = (args: Record<string, unknown>) => {
      const start = performance.now();
      let count = 0;
      let failed = false;
      try {
        const out = tool.handler(ctx, args);
        count = out.count;
        return { content: [{ type: "text" as const, text: out.text }], isError: out.isError };
      } catch (e) {
        failed = true;
        throw e;
      } finally {
        logToolCall({
          tool: tool.name,
          args,
          count,
          ms: performance.now() - start,
          ...(failed ? { error: true } : {}),
        });
      }
    };

    // 引数の無いツールに inputSchema: {} を渡すと、クライアントが arguments を省いたとき
    // SDK が undefined を z.object({}) で検証して落とす。引数が無いなら inputSchema を渡さない。
    if (Object.keys(tool.inputSchema).length === 0) {
      server.registerTool(tool.name, { description: tool.description }, () => run({}));
    } else {
      server.registerTool(
        tool.name,
        { description: tool.description, inputSchema: tool.inputSchema },
        (args: Record<string, unknown>) => run(args),
      );
    }
  }

  return server;
}
