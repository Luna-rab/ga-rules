import { describe, expect, test } from "bun:test";
import { z } from "zod";
import type { ToolContext } from "../context";
import { openTestContext } from "../testing";
import { getRulesPage } from "./get-rules-page";

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
    expect(lines.some((l) => l.startsWith("例外:") && l.includes("Immortality"))).toBe(true);
  });

  test("General Rules 以外の節の条文 ID も入る", () => {
    const others = clausesOf("game-mechanics-damage").filter(
      (c) => !c.clause_id.startsWith("game-mechanics-damage#General Rules:"),
    );
    expect(others.length).toBeGreaterThan(0);
    for (const c of others) expect(out.text).toContain(`[${c.clause_id}]`);
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
