import { describe, expect, test } from "bun:test";
import { z } from "zod";
import type { ToolContext } from "../context";
import { openTestContext } from "../testing";
import { getTerm } from "./get-term";

const ClauseRow = z.object({ clause_id: z.string(), text: z.string() });

const ctx: ToolContext = openTestContext();
const call = (term: string) => getTerm.handler(ctx, { term });

// 期待値は索引から引く。ツールの出力を組み立てる側の関数は使わない。
function clausesOfSection(sectionId: string): { clause_id: string; text: string }[] {
  return ctx.db
    .query("SELECT clause_id, text FROM rule_clause WHERE section_id = ? ORDER BY position")
    .all(sectionId)
    .map((r) => ClauseRow.parse(r));
}

function expectSection(text: string, sectionId: string): void {
  const clauses = clausesOfSection(sectionId);
  expect(clauses.length).toBeGreaterThan(0);
  const lines = text.split("\n");
  let prev = -1;
  for (const c of clauses) {
    const at = lines.findIndex((l, i) => i > prev && l.trimStart().startsWith(`[${c.clause_id}] `));
    expect({ id: c.clause_id, found: at >= 0 }).toEqual({ id: c.clause_id, found: true });
    // 全文: 条文の本文が欠けない
    expect(text).toContain(c.text);
    prev = at;
  }
}

describe("get_term", () => {
  test("Bulwark は 2 つの定義を、それぞれの節の条文を全文で返す", () => {
    const out = call("Bulwark");
    expect(out.isError).toBeFalsy();
    expect(out.count).toBeGreaterThan(0);
    expectSection(out.text, "game-mechanics-counters#Bulwark");
    expectSection(out.text, "keywords-and-abilities#Bulwark");
  });

  test("大文字小文字を区別しない", () => {
    expect(call("bulwark").text).toBe(call("Bulwark").text);
    expect(call("BULWARK").text).toBe(call("Bulwark").text);
  });

  test("別名でも、その用語の定義が返る", () => {
    const out = call("Activating");
    expect(out.isError).toBeFalsy();
    expect(out.count).toBeGreaterThan(0);
    expectSection(out.text, "game-terms#Activate/Activating");
    expect(call("Activate").text).toBe(out.text);
  });

  test("Game Terms は game-terms の用語名の一覧を返す", () => {
    const out = call("Game Terms");
    expect(out.isError).toBeFalsy();
    expect(out.text).toContain("Activate");
    expect(out.text).toContain("get_term");
  });

  test("該当なしは isError を付けず、count は 0", () => {
    const out = call("zzzz-not-a-term");
    expect(out.isError).toBeFalsy();
    expect(out.count).toBe(0);
    expect(out.text.length).toBeGreaterThan(0);
    expect(out.text).not.toContain("[");
  });
});
