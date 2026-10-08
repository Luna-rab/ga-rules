import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { clientIp, createRateLimiter, rateLimit } from "./rate-limit";

function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("createRateLimiter", () => {
  test("IP ごとに 1 分の枠を超えると断り、次の分で戻る", () => {
    const c = clock();
    const allow = createRateLimiter({ perIpPerMinute: 2, globalPerSecond: 100, now: c.now });
    expect([allow("a"), allow("a"), allow("a")]).toEqual([true, true, false]);
    expect(allow("b")).toBe(true);
    c.advance(60_000);
    expect(allow("a")).toBe(true);
  });

  test("全体の 1 秒の枠を超えると、別の IP でも断る", () => {
    const c = clock();
    const allow = createRateLimiter({ perIpPerMinute: 100, globalPerSecond: 2, now: c.now });
    expect([allow("a"), allow("b"), allow("c")]).toEqual([true, true, false]);
    c.advance(1000);
    expect(allow("c")).toBe(true);
  });

  test("IP ごとの枠で断ったリクエストは全体の枠を減らさない", () => {
    const c = clock();
    const allow = createRateLimiter({ perIpPerMinute: 1, globalPerSecond: 2, now: c.now });
    expect([allow("a"), allow("a"), allow("a"), allow("b")]).toEqual([true, false, false, true]);
  });
});

describe("clientIp", () => {
  test("右端を使い、送信元が書いた左側は無視する", () => {
    expect(clientIp("1.1.1.1, 203.0.113.5")).toBe("203.0.113.5");
    expect(clientIp("203.0.113.5")).toBe("203.0.113.5");
    expect(clientIp(undefined)).toBe("unknown");
  });
});

describe("rateLimit", () => {
  test("断ると 429 と Retry-After を返す", async () => {
    const app = new Hono();
    app.use(rateLimit({ perIpPerMinute: 1, globalPerSecond: 10 }));
    app.post("/mcp", (c) => c.text("ok"));
    const req = () =>
      app.request("/mcp", { method: "POST", headers: { "x-forwarded-for": "203.0.113.5" } });
    expect((await req()).status).toBe(200);
    const res = await req();
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });
});
