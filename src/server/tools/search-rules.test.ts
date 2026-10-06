import { describe, expect, test } from "bun:test";
import { z } from "zod";
import type { ToolContext } from "../context";
import { openTestContext } from "../testing";
import { searchRules } from "./search-rules";

const NameRow = z.object({ name: z.string() });
const TitleRow = z.object({ title: z.string() });
const CountRow = z.object({ n: z.number() });

const ctx: ToolContext = openTestContext();
const call = (query: string) => searchRules.handler(ctx, { query });

const OMEN = "Cards in banishment with omen counters on them are omens.";

// 行頭の [ID] を取り出す。裁定の ID は #ruling: を含み、条文の ID は含まない。
function idsOf(text: string): { clauses: number[]; rulings: number[]; ids: string[] } {
  const lines = text.split("\n");
  const clauses: number[] = [];
  const rulings: number[] = [];
  const ids: string[] = [];
  lines.forEach((l, i) => {
    const m = /^\s*(?:[-*]\s*)?\[([^\]]+)\]/.exec(l);
    if (!m?.[1]) return;
    ids.push(m[1]);
    (m[1].includes("#ruling:") ? rulings : clauses).push(i);
  });
  return { clauses, rulings, ids };
}

describe("search_rules: 裁定", () => {
  const out = call("omen counters banishment");
  const lines = out.text.split("\n");

  test("isError を付けない", () => {
    expect(out.isError).toBeFalsy();
  });

  test("オーメンの裁定の文面は 1 回だけ出る", () => {
    expect(out.text.split(OMEN).length - 1).toBe(1);
  });

  test("付いているカードが 43 枚であることと、3 枚までのカード名が添えられる", () => {
    expect(out.text).toMatch(/\b43\b/);
    const names = ctx.db
      .query(
        `SELECT DISTINCT c.name FROM card_ruling r
         JOIN card c ON c.slug = r.card_slug
         WHERE r.description LIKE ?`,
      )
      .all(`${OMEN}%`)
      .map((r) => NameRow.parse(r).name);
    expect(names.length).toBe(43);
    const shown = names.filter((n) => out.text.includes(n));
    expect(shown.length).toBeGreaterThanOrEqual(1);
    expect(shown.length).toBeLessThanOrEqual(3);
  });

  test("その文面の行は [引用 ID] で始まる", () => {
    const at = lines.findIndex((l) => l.includes(OMEN));
    expect(at).toBeGreaterThanOrEqual(0);
    expect(lines[at]).toMatch(/^\s*(?:[-*]\s*)?\[[^\]]+#ruling:[^\]]+\]/);
  });
});

describe("search_rules: 条文と裁定の見出し", () => {
  const out = call("activate ability during opponent turn");
  const { clauses, rulings, ids } = idsOf(out.text);
  const lines = out.text.split("\n");

  test("条文は 1〜7 件、裁定は 3 件以下で、どの行にも [引用 ID] が付く", () => {
    expect(out.isError).toBeFalsy();
    expect(clauses.length).toBeGreaterThanOrEqual(1);
    expect(clauses.length).toBeLessThanOrEqual(7);
    expect(rulings.length).toBeLessThanOrEqual(3);
    expect(out.count).toBe(clauses.length + rulings.length);
  });

  test("引用 ID は索引にある条文・裁定の ID", () => {
    for (const id of ids) {
      const table = id.includes("#ruling:")
        ? "card_ruling WHERE cite_id"
        : "rule_clause WHERE clause_id";
      const n = CountRow.parse(ctx.db.query(`SELECT count(*) AS n FROM ${table} = ?`).get(id));
      expect({ id, n: n.n }).toEqual({ id, n: 1 });
    }
  });

  test("条文と裁定の間に、引用 ID で始まらない見出しの行がある", () => {
    expect(rulings.length).toBeGreaterThan(0);
    const firstR = Math.min(...rulings);
    const lastC = Math.max(...clauses);
    const [a, b] = firstR > lastC ? [lastC, firstR] : [Math.max(...rulings), Math.min(...clauses)];
    expect(a).toBeLessThan(b);
    const between = lines.slice(a + 1, b).filter((l) => l.trim() !== "");
    expect(between.length).toBeGreaterThan(0);
  });

  test("裁定の結果に title が ERRATA で始まる裁定は入らない", () => {
    const queries = [
      "activate ability during opponent turn",
      "errata",
      "ERRATA text changed",
      "omen counters banishment",
      "card text now reads",
    ];
    for (const q of queries) {
      const r = idsOf(call(q).text);
      for (const id of r.ids.filter((i) => i.includes("#ruling:"))) {
        const row = ctx.db.query("SELECT title FROM card_ruling WHERE cite_id = ?").get(id);
        expect({ q, id, errata: TitleRow.parse(row).title.startsWith("ERRATA") }).toEqual({
          q,
          id,
          errata: false,
        });
      }
    }
  });
});

describe("search_rules: 検索語", () => {
  test("FTS5 の構文になる語を含んでも例外を投げず、isError も付かない", () => {
    for (const q of [
      "last-known information",
      "Class Bonus (2)",
      `"quote`,
      "a AND",
      "NEAR(",
      "x*",
    ]) {
      expect(() => call(q)).not.toThrow();
      expect({ q, isError: call(q).isError }).toEqual({ q, isError: undefined });
    }
  });

  test("空の query と英数字を含まない query は isError", () => {
    for (const q of ["", "   ", "!!!", "---", "()", "「」"]) {
      const out = call(q);
      expect({ q, isError: out.isError }).toEqual({ q, isError: true });
      expect(out.count).toBe(0);
    }
  });
});
