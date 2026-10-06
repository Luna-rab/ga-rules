import { beforeAll, describe, expect, spyOn, test } from "bun:test";
import { z } from "zod";
import { createApp } from "./app";
import { logToolCall } from "./log";
import { openTestContext } from "./testing";

function rpc(method: string, params: Record<string, unknown> = {}): Request {
  return new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // SDK は両方が無いと 406 を返す。
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

const ToolInfo = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.object({
    properties: z.record(z.string(), z.object({ type: z.string().optional() })).optional(),
    required: z.array(z.string()).optional(),
  }),
});
type ToolInfo = z.infer<typeof ToolInfo>;
const Result = z.object({ result: z.record(z.string(), z.unknown()) });

const EXPECTED_NAMES = [
  "get_game_overview",
  "get_rules_page",
  "get_term",
  "search_rules",
  "find_cards",
  "search_cards",
  "get_card",
];

const SEARCH_CARDS_STRINGS = [
  "text",
  "type",
  "subtype",
  "class",
  "element",
  "cost_type",
  "speed",
  "legal_in",
  "banned_in",
];
const SEARCH_CARDS_NUMBERS = [
  "cost_min",
  "cost_max",
  "level_min",
  "level_max",
  "power_min",
  "power_max",
  "life_min",
  "life_max",
  "durability_min",
  "durability_max",
];

describe("/mcp（実データの索引）", () => {
  let app: ReturnType<typeof createApp>;
  let tools: ToolInfo[];

  async function call(method: string, params: Record<string, unknown> = {}) {
    const res = await app.request(rpc(method, params));
    expect(res.status).toBe(200);
    return Result.parse(await res.json()).result;
  }

  beforeAll(async () => {
    app = createApp(openTestContext());
    tools = z.array(ToolInfo).parse((await call("tools/list")).tools);
  });

  test("initialize にサーバー名を返す", async () => {
    const result = await call("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "0" },
    });
    expect(result.serverInfo).toMatchObject({ name: "ga-rules" });
  });

  test("initialize の instructions の先頭 512 文字に get_game_overview が入る", async () => {
    const result = await call("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "0" },
    });
    const instructions = z.string().parse(result.instructions);
    expect(instructions.slice(0, 512)).toContain("get_game_overview");
  });

  test("Accept に text/event-stream が無ければ 406 を返す", async () => {
    const req = rpc("initialize");
    req.headers.set("Accept", "application/json");
    const res = await app.request(req);
    expect(res.status).toBe(406);
  });

  test("tools/list は 7 つのツールを返す", () => {
    expect(tools.map((t) => t.name).toSorted()).toEqual([...EXPECTED_NAMES].toSorted());
  });

  test("get_game_overview の説明に Grand Archive の話題では最初に呼ぶ旨が入る", () => {
    const tool = tools.find((t) => t.name === "get_game_overview");
    expect(tool?.description).toMatch(/Grand Archive/);
    expect(tool?.description).toMatch(/first/i);
  });

  test("各ツールの inputSchema の JSON は 16,384 バイト未満", () => {
    for (const t of tools) {
      const bytes = new TextEncoder().encode(JSON.stringify(t.inputSchema)).length;
      expect({ name: t.name, small: bytes < 16_384 }).toEqual({ name: t.name, small: true });
    }
  });

  test("inputSchema のキーと必須が設計の表と一致する", () => {
    const byName = new Map(tools.map((t) => [t.name, t.inputSchema]));
    const keys = (name: string) => Object.keys(byName.get(name)?.properties ?? {}).toSorted();
    const required = (name: string) => byName.get(name)?.required ?? [];

    expect(keys("get_game_overview")).toEqual([]);
    expect(keys("get_rules_page")).toEqual(["page_id"]);
    expect(required("get_rules_page")).toEqual(["page_id"]);
    expect(keys("get_term")).toEqual(["term"]);
    expect(required("get_term")).toEqual(["term"]);
    expect(keys("search_rules")).toEqual(["query"]);
    expect(required("search_rules")).toEqual(["query"]);
    expect(keys("find_cards")).toEqual(["name"]);
    expect(required("find_cards")).toEqual(["name"]);
    expect(keys("get_card")).toEqual(["slugs"]);
    expect(required("get_card")).toEqual(["slugs"]);
    expect(byName.get("get_card")?.properties?.slugs?.type).toBe("array");

    expect(keys("search_cards")).toEqual(
      [...SEARCH_CARDS_STRINGS, ...SEARCH_CARDS_NUMBERS].toSorted(),
    );
    expect(required("search_cards")).toEqual([]);
    const props = byName.get("search_cards")?.properties ?? {};
    for (const k of SEARCH_CARDS_STRINGS)
      expect({ k, type: props[k]?.type }).toEqual({ k, type: "string" });
    for (const k of SEARCH_CARDS_NUMBERS)
      expect({ k, type: props[k]?.type }).toEqual({ k, type: "number" });
  });

  test("tools/call で get_game_overview を呼ぶと JSON 1 行が標準出力に出る", async () => {
    const spy = spyOn(console, "log").mockImplementation(() => {});
    const result = await call("tools/call", { name: "get_game_overview", arguments: {} });
    const lines = spy.mock.calls
      .map((c) => c[0])
      .filter((a): a is string => typeof a === "string")
      .flatMap((s) => {
        try {
          const parsed = z.record(z.string(), z.unknown()).safeParse(JSON.parse(s));
          return parsed.success ? [parsed.data] : [];
        } catch {
          return [];
        }
      })
      .filter((o) => o.tool === "get_game_overview");
    spy.mockRestore();

    expect(result.isError).toBeFalsy();
    expect(lines).toHaveLength(1);
    const [entry] = lines;
    expect(entry?.args).toEqual({});
    expect(typeof entry?.count).toBe("number");
    expect(typeof entry?.ms).toBe("number");
    expect(entry?.ms).toBeGreaterThanOrEqual(0);
  });
});

describe("logToolCall", () => {
  test("console.log に JSON.stringify した 1 行を渡す", () => {
    const spy = spyOn(console, "log").mockImplementation(() => {});
    try {
      logToolCall({ tool: "get_term", args: { term: "Bulwark" }, count: 2, ms: 3 });
      expect(spy).toHaveBeenCalledTimes(1);
      const line = z.string().parse(spy.mock.calls[0]?.[0]);
      expect(line).not.toContain("\n");
      expect(JSON.parse(line)).toEqual({
        tool: "get_term",
        args: { term: "Bulwark" },
        count: 2,
        ms: 3,
      });
    } finally {
      spy.mockRestore();
    }
  });
});
