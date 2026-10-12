import type { MiddlewareHandler } from "hono";

export type RateLimitOptions = {
  perIpPerMinute: number;
  globalPerSecond: number;
  now?: () => number;
};

// 数えた IP がこれを超えたら、新しい IP は数えずに全体の上限だけで止める。
// 送信元を散らした大量のリクエストでメモリが膨らまないようにする。
const MAX_TRACKED_IPS = 50_000;

// 固定窓で数える。最大インスタンス数が 1 なので、メモリ上で数えれば全リクエストを数えられる。
// Claude と ChatGPT のリクエストは少数の IP から全利用者分がまとめて届くので、IP ごとの枠は緩くし、
// 請求額は全体の上限で抑える。
// 返り値は待つべき秒数。0 なら通す。
export function createRateLimiter(options: RateLimitOptions): (ip: string) => number {
  const now = options.now ?? Date.now;
  let minute = -1;
  const perIp = new Map<string, number>();
  let second = -1;
  let global = 0;

  return (ip) => {
    const t = now();
    const m = Math.floor(t / 60_000);
    if (m !== minute) {
      minute = m;
      perIp.clear();
    }
    const s = Math.floor(t / 1000);
    if (s !== second) {
      second = s;
      global = 0;
    }

    // IP ごとの枠を先に見る。1 つの送信元が全体の枠を使い切り、他の利用者を締め出すのを防ぐ。
    const count = perIp.get(ip) ?? 0;
    if (count >= options.perIpPerMinute) return Math.ceil((minute + 1) * 60 - t / 1000);
    if (global >= options.globalPerSecond) return 1;
    if (perIp.has(ip) || perIp.size < MAX_TRACKED_IPS) perIp.set(ip, count + 1);
    global++;
    return 0;
  };
}

// Cloud Run の前段（Google Front End）は、受け取った X-Forwarded-For の右端に接続元の IP を足す。
// 左側は送信元が自由に書けるので、右端だけを信じる。
export function clientIp(forwardedFor: string | undefined): string {
  return forwardedFor?.split(",").at(-1)?.trim() || "unknown";
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const limiter = createRateLimiter(options);
  return async (c, next) => {
    const wait = limiter(clientIp(c.req.header("x-forwarded-for")));
    if (wait === 0) return next();
    // 断った応答は小さく保つ。外向きの転送量にも課金される。
    return c.json(
      { jsonrpc: "2.0", id: null, error: { code: -32000, message: "Rate limit exceeded" } },
      429,
      { "Retry-After": String(wait) },
    );
  };
}
