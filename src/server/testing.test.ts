import { afterEach, describe, expect, test } from "bun:test";
import { openTestContext } from "./testing";

describe("openTestContext", () => {
  const saved = process.env.INDEX_PATH;
  afterEach(() => {
    if (saved === undefined) delete process.env.INDEX_PATH;
    else process.env.INDEX_PATH = saved;
  });

  test("INDEX_PATH のファイルが無ければ、取得とビルドの両方のコマンドを案内する Error を投げる", () => {
    // モジュールの読み込み後に設定しても効く（呼んだ時点で読まれる）
    process.env.INDEX_PATH = "/nonexistent/__no_such_index__.sqlite";
    let error: unknown;
    try {
      openTestContext();
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(Error);
    const message = error instanceof Error ? error.message : "";
    expect(message).toContain("bun run fetch:data");
    expect(message).toContain("bun run build:index");
  });
});
