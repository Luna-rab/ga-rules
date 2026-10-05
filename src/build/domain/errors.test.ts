import { describe, expect, test } from "bun:test";
import { DataError } from "./errors";

describe("DataError", () => {
  test("message は「場所: 値」、where は場所", () => {
    const e = new DataError("cards/x.json", "slug foo");
    expect(e.message).toBe("cards/x.json: slug foo");
    expect(e.where).toBe("cards/x.json");
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(DataError);
  });

  test("throw すると呼び出し元で場所付きの message を受け取れる", () => {
    expect(() => {
      throw new DataError("game-terms#Negated", "link game-terms.md#negated");
    }).toThrow("game-terms#Negated: link game-terms.md#negated");
  });
});
