import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { clientIp, createRateLimiter, rateLimit } from "./rate-limit";

function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("createRateLimiter", () => {
  test("IP ごとに 1 分の枠を超えると、その分の終わりまでの秒数を返し、次の分で戻る", () => {
    const c = clock();
    const limit = createRateLimiter({ perIpPerMinute: 2, globalPerSecond: 100, now: c.now });
    expect([limit("a"), limit("a")]).toEqual([0, 0]);
    c.advance(45_500);
    expect(limit("a")).toBe(15);
    expect(limit("b")).toBe(0);
    c.advance(14_500);
    expect(limit("a")).toBe(0);
  });

  test("全体の 1 秒の枠を超えると、別の IP でも 1 秒待たせる", () => {
    const c = clock();
    const limit = createRateLimiter({ perIpPerMinute: 100, globalPerSecond: 2, now: c.now });
    expect([limit("a"), limit("b"), limit("c")]).toEqual([0, 0, 1]);
    c.advance(1000);
    expect(limit("c")).toBe(0);
  });

  test("IP ごとの枠で断ったリクエストは全体の枠を減らさない", () => {
    const c = clock();
    const limit = createRateLimiter({ perIpPerMinute: 1, globalPerSecond: 2, now: c.now });
    expect([limit("a"), limit("a"), limit("a"), limit("b")]).toEqual([0, 60, 60, 0]);
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
  test("断ると 429 と、待つ秒数の Retry-After を返す", async () => {
    const app = new Hono();
    app.use(rateLimit({ perIpPerMinute: 100, globalPerSecond: 1 }));
    app.post("/mcp", (c) => c.text("ok"));
    const req = () =>
      app.request("/mcp", { method: "POST", headers: { "x-forwarded-for": "203.0.113.5" } });
    expect((await req()).status).toBe(200);
    const res = await req();
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("1");
  });
});
