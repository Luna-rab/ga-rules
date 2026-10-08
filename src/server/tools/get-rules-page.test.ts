import { describe, expect, test } from "bun:test";
import { z } from "zod";
import type { ToolContext } from "../context";
import { openTestContext } from "../testing";
import { getRulesPage } from "./get-rules-page";
import { unrewrittenLinks } from "../tests/links";

const ClauseRow = z.object({ clause_id: z.string(), text: z.string() });

const ctx: ToolContext = openTestContext();
const call = (page_id: string) => getRulesPage.handler(ctx, { page_id });

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

describe("get_rules_page: 通常のページ", () => {
  const out = call("game-mechanics-damage#General Rules:13");
  const lines = out.text.split("\n");

  test("isError を付けない", () => {
    expect(out.isError).toBeFalsy();
    expect(out.count).toBeGreaterThan(0);
  });

  test("全節の条文が position の順に [clause_id] 付きで並ぶ", () => {
    const clauses = clausesOf("game-mechanics-damage");
    expect(clauses.length).toBeGreaterThan(1);
    let prev = -1;
    for (const c of clauses) {
      const head = `[${c.clause_id}] `;
      const at = lines.findIndex((l, i) => i > prev && l.trimStart().startsWith(head));
      expect({ id: c.clause_id, found: at >= 0 }).toEqual({ id: c.clause_id, found: true });
      prev = at;
    }
  });

  test("General Rules:13 と Immortality の例外が入る", () => {
    expect(out.text).toContain("[game-mechanics-damage#General Rules:13]");
    expect(lines.some((l) => l.startsWith("Exception:") && l.includes("Immortality"))).toBe(true);
  });

  test("節付きの page_id でも、索引にあるこのページの条文 ID がすべて入る", () => {
    const clauses = clausesOf("game-mechanics-damage");
    expect(clauses.length).toBe(21);
    for (const c of clauses) expect(out.text).toContain(`[${c.clause_id}]`);
  });

  test("節が 2 つ以上あるページは、ある節の条文 ID を渡しても別の節の条文 ID が入り、節・条文の順に並ぶ", () => {
    const pageId = "game-mechanics-counters";
    const sections = ctx.db
      .query("SELECT section_id FROM rule_section WHERE page_id = ? ORDER BY position")
      .all(pageId)
      .map((r) => z.object({ section_id: z.string() }).parse(r).section_id);
    expect(sections.length).toBeGreaterThan(1);
    const clauses = clausesOf(pageId);
    const secondSection = sections[1];
    expect(secondSection).toBeDefined();
    const second = ctx.db
      .query("SELECT clause_id FROM rule_clause WHERE section_id = ? ORDER BY position LIMIT 1")
      .get(secondSection ?? "");
    const given = z.object({ clause_id: z.string() }).parse(second).clause_id;

    const res = call(given);
    expect(res.isError).toBeFalsy();
    const resLines = res.text.split("\n");
    let prev = -1;
    for (const c of clauses) {
      const head = `[${c.clause_id}] `;
      const at = resLines.findIndex((l, i) => i > prev && l.trimStart().startsWith(head));
      expect({ id: c.clause_id, found: at >= 0 }).toEqual({ id: c.clause_id, found: true });
      prev = at;
    }
    const otherSection = clauses.find((c) => !c.clause_id.startsWith(`${sections[1]}:`));
    expect(otherSection).toBeDefined();
    expect(res.text).toContain(`[${otherSection?.clause_id}]`);
    expect(res.text).toBe(call(pageId).text);
  });

  test("# 以降を付けないときも同じ text", () => {
    expect(call("game-mechanics-damage").text).toBe(out.text);
  });
});

describe("get_rules_page: 用語集のページ", () => {
  test("keywords-and-abilities は用語名の一覧と get_term を返し、条文の本文は返さない", () => {
    const out = call("keywords-and-abilities");
    expect(out.isError).toBeFalsy();
    expect(out.text).toContain("Bulwark");
    expect(out.text).toContain("get_term");
    expect(out.text).not.toContain("[keywords-and-abilities#Bulwark:1]");
    expect(out.text).not.toContain("is a static ability of objects");
  });

  test("game-terms も用語名の一覧と get_term を返す", () => {
    const out = call("game-terms");
    expect(out.isError).toBeFalsy();
    expect(out.text).toContain("Activate");
    expect(out.text).toContain("get_term");
    for (const c of clausesOf("game-terms").slice(0, 5)) {
      expect(out.text).not.toContain(`[${c.clause_id}]`);
    }
  });
});

describe("get_rules_page: 呼び方の誤り", () => {
  test("存在しない page_id は isError で、目次か search_rules で探す旨を返す", () => {
    const out = call("no-such-page");
    expect(out.isError).toBe(true);
    expect(out.text).toContain("get_game_overview");
    expect(out.text).toContain("search_rules");
    expect(out.count).toBe(0);
  });
});

const UrlRow = z.object({ url: z.string() });
const urlOf = (table: "rule_page" | "rule_section", column: string, id: string): string =>
  UrlRow.parse(ctx.db.query(`SELECT url FROM ${table} WHERE ${column} = ?`).get(id)).url;

describe("get_rules_page: 公式サイトの URL", () => {
  test("節の見出しに、その節の URL が 1 回付く", () => {
    const out = call("playing-cards-resolution");
    const url =
      "https://rules.gatcg.com/game-mechanics/game-mechanics-playing-cards/playing-cards-resolution#general-rules";
    expect(out.text).toContain(`#### General Rules (${url})`);
    expect(out.text.split(url)).toHaveLength(2);
  });

  test("どの節の見出しも、索引の節の URL が付く。条文の行には URL が付かない", () => {
    const pageId = "game-mechanics-counters";
    const out = call(pageId);
    const sections = ctx.db
      .query("SELECT section_id, heading, url FROM rule_section WHERE page_id = ?")
      .all(pageId)
      .map((r) =>
        z.object({ section_id: z.string(), heading: z.string(), url: z.string() }).parse(r),
      );
    expect(sections.length).toBeGreaterThan(1);
    for (const s of sections) expect(out.text).toContain(`#### ${s.heading} (${s.url})`);
    const clauseLines = out.text.split("\n").filter((l) => /^\[[^\]]+:\d/.test(l));
    expect(clauseLines.length).toBeGreaterThan(0);
    for (const l of clauseLines) expect(l).toMatch(/^\[[^\]]+\] (?!\(?https:)/);
  });

  test("README.md のページは、ディレクトリの URL が節の URL の元になる", () => {
    const url = urlOf("rule_page", "page_id", "general-rules-parts-of-a-card");
    expect(url).toBe("https://rules.gatcg.com/general-rules/general-rules-parts-of-a-card");
    const out = call("general-rules-parts-of-a-card");
    expect(out.text).toMatch(
      /#### .+ \(https:\/\/rules\.gatcg\.com\/general-rules\/general-rules-parts-of-a-card(#[^)]*)?\)/,
    );
  });

  test("本文のページへのリンクは [文言](URL) [target] に書き換わる", () => {
    const out = call("parts-of-a-card-stats");
    const damage = urlOf("rule_page", "page_id", "game-mechanics-damage");
    expect(out.text).toContain(`[damage](${damage}) [game-mechanics-damage]`);
    expect(unrewrittenLinks(out.text)).toEqual([]);
  });

  test("節見出しへのリンクは、target 全体を [] に残す", () => {
    const out = call("playing-cards-resolution");
    const target = "playing-cards-resolution#General Rules";
    const url = urlOf("rule_section", "section_id", target);
    expect(out.text).toMatch(
      new RegExp(`\\]\\(${url.replace(/[.#]/g, "\\$&")}\\) \\[${target}\\]`),
    );
    expect(unrewrittenLinks(out.text)).toEqual([]);
  });

  test("括弧を含む節見出しへのリンクも書き換わる", () => {
    const out = call("parts-of-a-card-element");
    const url = urlOf("rule_section", "section_id", "game-terms#Lineage (term)");
    expect(out.text).toContain(`[Lineage](${url}) [game-terms#Lineage (term)]`);
  });

  test("用語集のページは、条文を載せる節の見出しにも URL が付く", () => {
    const out = call("keywords-and-abilities");
    const url = urlOf(
      "rule_section",
      "section_id",
      "keywords-and-abilities#Keywords and Abilities",
    );
    expect(out.text).toContain(`#### Keywords and Abilities (${url})`);
  });
});
