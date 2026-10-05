import { Database } from "bun:sqlite";
import { beforeAll, describe, expect, test } from "bun:test";
import { createTables } from "../build/infra/create-tables";
import { createApp } from "./app";

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

describe("/mcp", () => {
  const db = new Database(":memory:", { strict: true });
  const app = createApp(db);

  beforeAll(async () => {
    await createTables(db);
  });

  test("initialize にサーバー名を返す", async () => {
    const res = await app.request(
      rpc("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "0" },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ result: { serverInfo: { name: "ga-rules" } } });
  });

  test("Accept に text/event-stream が無ければ 406 を返す", async () => {
    const req = rpc("initialize");
    req.headers.set("Accept", "application/json");
    const res = await app.request(req);
    expect(res.status).toBe(406);
  });
});
