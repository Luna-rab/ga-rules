import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { OVERVIEW_PAGE_IDS } from "../../shared/overview";
import type { ToolContext } from "../context";
import { openTestContext } from "../testing";
import { getGameOverview } from "./get-game-overview";

const PageRow = z.object({
  page_id: z.string(),
  title: z.string(),
  parent_page_id: z.string().nullable(),
});
const ClauseRow = z.object({ clause_id: z.string(), text: z.string() });

const ctx: ToolContext = openTestContext();
const out = getGameOverview.handler(ctx, {});

// 期待値は索引から引く。ツールの出力を組み立てる側の関数は使わない。
function clausesOf(pageId: string): { clause_id: string; text: string }[] {
  return ctx.db
    .query(
      `SELECT c.clause_id, c.text FROM rule_clause c
       JOIN rule_section s ON s.section_id = c.section_id
       WHERE s.page_id = ? ORDER BY s.position, c.position`,
    )
    .all(pageId)
    .map((r) => ClauseRow.parse(r));
}

const lines = out.text.split("\n");
const indentOf = (line: string) => line.length - line.trimStart().length;

describe("get_game_overview", () => {
  test("isError を付けず、件数を数で返す", () => {
    expect(out.isError).toBeFalsy();
    expect(typeof out.count).toBe("number");
    expect(out.count).toBeGreaterThan(0);
  });

  test("手書きの 3 項目が入る", () => {
    // 1. MTG などとは別のゲームだという説明
    expect(out.text).toMatch(/Magic|MTG/);
    // 2. 紛らわしい用語の一覧
    for (const term of ["Opportunity", "Intent", "Materialize", "Recollection"]) {
      expect(out.text).toContain(term);
    }
    // 3. この概要を根拠に答えず、該当ページを引いてから答える注意
    expect(out.text).toMatch(/(do not|don't|never)[^.]*\b(answer|rely|base)/i);
    expect(out.text).toMatch(/page/i);
  });

  test("概要の 5 ページの条文が [clause_id] 付きで、定数の順に並ぶ", () => {
    let from = 0;
    for (const pageId of OVERVIEW_PAGE_IDS) {
      const clauses = clausesOf(pageId);
      expect(clauses.length).toBeGreaterThan(0);
      let prev = -1;
      for (const c of clauses) {
        const head = `[${c.clause_id}] `;
        const at = lines.findIndex((l, i) => i > prev && l.trimStart().startsWith(head));
        expect({ id: c.clause_id, found: at >= 0 }).toEqual({ id: c.clause_id, found: true });
        expect(lines[at]).toContain(c.text.split("\n")[0] ?? "");
        prev = at;
      }
      // このページの先頭の条文は、前のページの末尾より後ろにある
      const first = lines.findIndex((l) => l.trimStart().startsWith(`[${clauses[0]?.clause_id}] `));
      expect(first).toBeGreaterThanOrEqual(from);
      from = prev;
    }
  });

  test("目次は rule_page.position の順で、子の行は親の行より深く字下げされる", () => {
    const pages = ctx.db
      .query("SELECT page_id, title, parent_page_id FROM rule_page ORDER BY position")
      .all()
      .map((r) => PageRow.parse(r));
    expect(pages.length).toBeGreaterThan(100);

    const lineOf = new Map<string, number>();
    let prev = -1;
    for (const p of pages) {
      const row = `${p.title} | ${p.page_id}`;
      const at = lines.findIndex((l, i) => i > prev && l.trim() === row);
      expect({ row, found: at >= 0 }).toEqual({ row, found: true });
      lineOf.set(p.page_id, at);
      prev = at;
    }
    for (const p of pages) {
      if (p.parent_page_id === null) continue;
      const child = lines[lineOf.get(p.page_id) ?? -1] ?? "";
      const parent = lines[lineOf.get(p.parent_page_id) ?? -1] ?? "";
      expect({ page: p.page_id, deeper: indentOf(child) > indentOf(parent) }).toEqual({
        page: p.page_id,
        deeper: true,
      });
    }
  });

  test("目次に General Rules の行があり、その子の Objectives は深く字下げされる", () => {
    const parent = lines.find((l) => l.trim() === "General Rules | general-rules");
    const child = lines.find(
      (l) => l.trim() === "General Rules - Objectives | general-rules-objectives",
    );
    expect(parent).toBeDefined();
    expect(child).toBeDefined();
    expect(indentOf(child ?? "")).toBeGreaterThan(indentOf(parent ?? ""));
  });

  test("変更履歴は入らない", () => {
    expect(out.text).not.toMatch(/changelog/i);
  });
});
