import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { OVERVIEW_PAGE_IDS } from "../../shared/overview";
import type { ToolContext } from "../context";
import { findTerms } from "../lookup/glossary";
import { ELEMENTS } from "../overview-text";
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

function idExists(id: string): boolean {
  return (
    ctx.db.query("SELECT 1 FROM rule_page WHERE page_id = ?").get(id) !== null ||
    ctx.db.query("SELECT 1 FROM rule_section WHERE section_id = ?").get(id) !== null ||
    ctx.db.query("SELECT 1 FROM rule_clause WHERE clause_id = ?").get(id) !== null
  );
}

const lines = out.text.split("\n");
const indentOf = (line: string) => line.length - line.trimStart().length;

describe("get_game_overview", () => {
  test("isError を付けず、件数を数で返す", () => {
    expect(out.isError).toBeFalsy();
    expect(typeof out.count).toBe("number");
    expect(out.count).toBeGreaterThan(0);
  });

  test("手書きの項目が入る", () => {
    // 固有名詞を訳さない指示は、ほかの何よりも先に置く
    expect(lines[2]).toContain("proper nouns in English");
    expect(out.text).toMatch(/Magic|MTG/);
    // この概要を根拠に答えず、該当ページを引いてから答える注意
    expect(out.text).toMatch(/(do not|don't|never)[^.]*\b(answer|rely|base)/i);
    expect(out.text).toMatch(/page/i);
    for (const heading of ["Terms from other games", "Basic terms", "Game flow", "Elements"]) {
      expect(out.text).toContain(`## ${heading}`);
    }
    expect(out.text).toContain("| exile | Banish");
    expect(out.text).toContain("| priority | Opportunity");
  });

  test("調べる先に書いた語は get_term で 1 つに決まる", () => {
    const names = [...out.text.matchAll(/get_term\("([^"]+)"\)/g)].map((m) => m[1] ?? "");
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      const hits = findTerms(ctx.catalog.terms, name).length;
      expect({ name, hits }).toEqual({ name, hits: 1 });
    }
  });

  test("調べる先に書いたページ ID・節 ID・条文 ID は索引にある", () => {
    // 手書きの部分だけを見る。抜粋と目次は索引から作るので確かめなくてよい
    const handWritten = out.text.slice(0, out.text.indexOf("## Rules excerpts"));
    const ids = [...handWritten.matchAll(/`([a-z0-9-]+(?:#[^`]+)?)`/g)].map((m) => m[1] ?? "");
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect({ id, found: idExists(id) }).toEqual({ id, found: true });
  });

  test("エレメントの一覧は、索引のカードにあるエレメントと過不足なく一致する", () => {
    // 新しいエレメントのカードが出たら、overview-text.ts の ELEMENTS に足す
    const inCards = ctx.db
      .query("SELECT DISTINCT j.value AS element FROM card, json_each(card.elements) j")
      .all()
      .map((r) => z.object({ element: z.string() }).parse(r).element)
      .toSorted();
    const listed = ELEMENTS.flatMap((e) => e.names.map((n) => n.toUpperCase())).toSorted();
    expect(listed).toEqual(inCards);
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
