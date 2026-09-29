import { Database } from "bun:sqlite";
import { createApp } from "./app";

const db = new Database(process.env.INDEX_PATH ?? "index.sqlite", {
  readonly: true,
  strict: true,
});

export default {
  // Cloud Run は PORT で待ち受けるポートを渡してくる。
  port: Number(process.env.PORT ?? 3000),
  fetch: createApp(db).fetch,
};
