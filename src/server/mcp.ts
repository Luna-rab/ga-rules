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

  logValidationFailures(server);

  return server;
}

// 引数の型の誤りは、SDK が handler を呼ぶ前の検証で落ちる（run まで届かない）。
// モデルが引数を誤った呼び出しこそログで見たいので、SDK の private メソッド validateToolInput を包んで 1 行書く。
// 公開された差し込み口が無いための回避策。SDK の更新でメソッドが無くなったら、createMcpServer が例外を投げる。
// createMcpServer は /mcp のリクエストごとに呼ばれるので、起動は通り、/mcp へのリクエストがすべて 500 になる（app.test.ts が落ちる）。
function logValidationFailures(server: McpServer): void {
  const original: unknown = Reflect.get(server, "validateToolInput");
  if (typeof original !== "function") {
    throw new Error("SDK に validateToolInput が無い。引数の誤りのログの差し込み先を見直す");
  }
  Reflect.set(server, "validateToolInput", async (tool: unknown, args: unknown, name: string) => {
    try {
      return await Reflect.apply(original, server, [tool, args ?? {}, name]);
    } catch (e) {
      logToolCall({ tool: name, args: args ?? {}, count: 0, ms: 0, error: true });
      throw e;
    }
  });
}
