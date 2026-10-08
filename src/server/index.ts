import { createApp } from "./app";
import { openContext } from "./context";

const ctx = openContext(process.env.INDEX_PATH ?? "index.sqlite");

export default {
  // Cloud Run は PORT で待ち受けるポートを渡してくる。
  port: Number(process.env.PORT ?? 3000),
  fetch: createApp(ctx, {
    // 見込みは月 2.4 万リクエスト（平均で 1 分に 1 件未満）。全体の上限で、濫用されたときの
    // 外向きの転送量を 1 秒 10 件分に抑える。断った応答は小さいので、転送量はほぼ増えない。
    rateLimit: { perIpPerMinute: 120, globalPerSecond: 10 },
  }).fetch,
};
