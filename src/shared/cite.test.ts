import { describe, expect, test } from "bun:test";
import { formatRulingCiteId, pageIdOfCiteId, parseRulingCiteId } from "./cite";

describe("formatRulingCiteId / parseRulingCiteId", () => {
  test("format は slug#ruling:日付:n を返し、parse は同じ値に戻す", () => {
    const cite = { cardSlug: "beguiling-coup", date: "2025-06-27", n: 1 };
    const id = formatRulingCiteId(cite);

    expect(id).toBe("beguiling-coup#ruling:2025-06-27:1");
    expect(parseRulingCiteId(id)).toEqual(cite);
  });

  test("0 埋めされない日付 2023-2-6 も往復する", () => {
    const cite = { cardSlug: "spirit-blade-ensoul", date: "2023-2-6", n: 1 };
    const id = formatRulingCiteId(cite);

    expect(id).toBe("spirit-blade-ensoul#ruling:2023-2-6:1");
    expect(parseRulingCiteId(id)).toEqual(cite);
  });

  test("n が 2 桁でも往復する", () => {
    const cite = { cardSlug: "a-card", date: "2024-01-02", n: 12 };

    expect(parseRulingCiteId(formatRulingCiteId(cite))).toEqual(cite);
  });

  test("条文の引用 ID と、ページ ID だけの文字列は null", () => {
    expect(parseRulingCiteId("game-mechanics-damage#General Rules:13")).toBeNull();
    expect(parseRulingCiteId("game-mechanics-damage")).toBeNull();
  });
});

describe("pageIdOfCiteId", () => {
  test("# より前を返す", () => {
    expect(pageIdOfCiteId("game-mechanics-damage#General Rules:13")).toBe("game-mechanics-damage");
  });

  test("# が無ければ文字列そのものを返す", () => {
    expect(pageIdOfCiteId("game-mechanics-damage")).toBe("game-mechanics-damage");
  });
});
