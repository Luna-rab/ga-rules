import { createApp } from "./app";
import { openContext } from "./context";

const ctx = openContext(process.env.INDEX_PATH ?? "index.sqlite");

export default {
  // Cloud Run は PORT で待ち受けるポートを渡してくる。
  port: Number(process.env.PORT ?? 3000),
  fetch: createApp(ctx).fetch,
};
