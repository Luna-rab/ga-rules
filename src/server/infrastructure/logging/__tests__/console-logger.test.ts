import { describe, expect, spyOn, test } from "bun:test";
import { z } from "zod";
import { logToolCall } from "../console-logger";

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
