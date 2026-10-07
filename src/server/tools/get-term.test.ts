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

  test("Buff と Buff Counters はどちらも、カウンターのページと用語集の定義を返す", () => {
    for (const word of ["Buff", "Buff Counters"]) {
      const out = call(word);
      expectSection(out.text, "game-mechanics-counters#Buff");
      expectSection(out.text, "game-terms#Buff Counters");
    }
  });

  test("Token は用語集の定義とトークンのページを返す", () => {
    expect(call("Token").text).toContain("[game-mechanics-tokens#General Rules:3]");
  });

  test("waking up のように複数の用語に当たる語は、候補を並べて count は 0", () => {
    const out = call("waking up");
    expect(out.isError).toBeFalsy();
    expect(out.count).toBe(0);
    expect(out.text).toContain("Wake Up, Wake Up Phase");
  });

  test("該当なしは isError を付けず、count は 0", () => {
    const out = call("zzzz-not-a-term");
    expect(out.isError).toBeFalsy();
    expect(out.count).toBe(0);
    expect(out.text.length).toBeGreaterThan(0);
    expect(out.text).not.toContain("[");
  });
});

describe("get_term: 書き方の違い", () => {
  const ISSUE_20_WORDS: [string, string][] = [
    ["Ranged N", "Ranged"],
    ["Agility N", "Agility"],
    ["Critical N", "Critical"],
    ["Memory N+", "Memory"],
    ["Level (N)", "Level"],
    ["Level Locked N", "Level Locked"],
    ["Multistrike N", "Multistrike"],
    ["Died/Dies and Kills/Killed", "Died"],
    ["Play/Played", "Play"],
    ["Lineage (term)", "Lineage"],
    ["Counter", "Counters"],
    ["Taunts", "Taunt"],
    ["Imbued", "Imbue"],
    ["allies", "Ally"],
    ["leveling up", "Leveling Up"],
    ["destroy", "Destruction"],
    ["destroyed", "Destruction"],
    ["kill", "Died"],
    ["killed", "Died"],
    ["Control", "Control and Ownership"],
    ["Owner", "Control and Ownership"],
    ["Ownership", "Control and Ownership"],
    ["last known information", "Last-Known Information"],
    ["Floating-Memory", "Floating Memory"],
    ["on-hit", "On Hit"],
    ["True   Sight", "True Sight"],
    ["Recollection", "Recollection Phase"],
    ["materialize", "Materialize Phase"],
    ["Deluge", "Deluge"],
    ["Balance", "Balance"],
    ["Harmonize", "Harmonize"],
    ["Cardistry", "Cardistry"],
    ["Upkeep", "Upkeep"],
    ["Equestrian", "Equestrian"],
    ["Siegeable", "Siegeable"],
    ["Gun", "Gun"],
    ["Bow", "Bow"],
    ["Aetherwing", "Aetherwing"],
    ["Delevel", "Deleveling"],
  ];

  test.each(ISSUE_20_WORDS)("%s → %s", (word, name) => {
    const out = call(word);
    expect(out.count).toBeGreaterThan(0);
    expect(out.text.split("\n")[0]).toBe(`## ${name}`);
  });

  test("索引の見出しとページ題は、表示どおりの文字列で用語が返る", () => {
    const headings = ctx.db
      .query("SELECT heading FROM rule_section")
      .all()
      .map((r) => z.object({ heading: z.string() }).parse(r).heading);
    const titles = ctx.db
      .query("SELECT title FROM rule_page")
      .all()
      .map((r) => z.object({ title: z.string() }).parse(r).title.split(" - ").at(-1) ?? "");
    // General Rules と番号付きの手順（1.1 Announcing Activation）は用語にしていない
    const missed = [...headings, ...titles]
      .filter((s) => s !== "General Rules" && !/^\d/.test(s))
      .filter((s) => call(s).count === 0);
    expect(missed).toEqual([]);
  });

  test.each([
    ["Status", "Statuses"],
    ["Class Bonuses", "Class Bonus"],
    ["Stats", "Stats"],
  ])("%s → %s", (word, name) => {
    expect(call(word).text.split("\n")[0]).toBe(`## ${name}`);
  });

  test("題の一部の語（Card・States）は、`and` で並んだ別の題に当たらない", () => {
    for (const word of ["Card", "States"]) expect(call(word).count).toBe(0);
  });

  test("`/` で並べた名前は、それぞれの用語を候補に並べる", () => {
    expect(call("Gun / Bow / Aetherwing").text).toContain("Gun, Bow, Aetherwing");
  });
});
