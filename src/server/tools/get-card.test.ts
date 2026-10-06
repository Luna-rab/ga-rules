import { describe, expect, test } from "bun:test";
import { z } from "zod";
import type { ToolContext } from "../context";
import { openTestContext } from "../testing";
import { getCard } from "./get-card";

const ctx: ToolContext = openTestContext();
const run = (slugs: string[]) => getCard.handler(ctx, { slugs });

const CardRow = z.object({ name: z.string(), effect_raw: z.string().nullable() });
const RulingRow = z.object({ cite_id: z.string(), description: z.string() });
const TermRow = z.object({
  name: z.string(),
  page_id: z.string(),
  section_id: z.string().nullable(),
});
const ClauseRow = z.object({ clause_id: z.string(), text: z.string() });
const RefRow = z.object({ slug: z.string(), name: z.string(), kind: z.string() });
const CiteRow = z.object({ cite_id: z.string() });

describe("get_card", () => {
  test("Beguiling Coup は裁定 3 件を引用 ID と文面つきで、効果テキストとともに返す", () => {
    const out = run(["beguiling-coup"]);
    expect(out.isError).toBeFalsy();
    for (const id of [
      "[beguiling-coup#ruling:2025-07-18:1]",
      "[beguiling-coup#ruling:2025-07-18:2]",
      "[beguiling-coup#ruling:2025-06-27:1]",
    ]) {
      expect(out.text).toContain(id);
    }
    const rulings = ctx.db
      .query("SELECT cite_id, description FROM card_ruling WHERE card_slug = 'beguiling-coup'")
      .all()
      .map((r) => RulingRow.parse(r));
    expect(rulings.length).toBe(3);
    for (const r of rulings) expect(out.text).toContain(r.description);

    const card = CardRow.parse(
      ctx.db.query("SELECT name, effect_raw FROM card WHERE slug = 'beguiling-coup'").get(),
    );
    expect(card.effect_raw).toBeTruthy();
    expect(out.text).toContain(card.effect_raw ?? "");
    expect(out.text).toContain(card.name);
  });

  test("Divine Comedy は game-mechanics-mastery の条文を全文で返す", () => {
    const out = run(["divine-comedy"]);
    expect(out.isError).toBeFalsy();
    expect(out.text).toContain("[game-mechanics-mastery#Divine Comedy:1]");
    const clauses = ctx.db
      .query(
        `SELECT c.clause_id, c.text FROM clause_card cc JOIN rule_clause c ON c.clause_id = cc.clause_id
         WHERE cc.card_slug = 'divine-comedy'`,
      )
      .all()
      .map((r) => ClauseRow.parse(r));
    expect(clauses.length).toBeGreaterThan(0);
    for (const c of clauses) {
      expect(out.text).toContain(`[${c.clause_id}]`);
      for (const line of c.text.split("\n").filter((l) => l.trim() !== "")) {
        expect(out.text).toContain(line.trim());
      }
    }
  });

  test("カードに結んだ用語を、名前と定義の引用 ID つきで返す", () => {
    const out = run(["beguiling-coup"]);
    const terms = ctx.db
      .query(
        `SELECT t.name, d.page_id, d.section_id FROM card_term ct
         JOIN term t ON t.term_id = ct.term_id
         JOIN term_definition d ON d.term_id = t.term_id
         WHERE ct.card_slug = 'beguiling-coup'`,
      )
      .all()
      .map((r) => TermRow.parse(r));
    expect(terms.map((t) => t.name)).toContain("Class Bonus");
    for (const t of terms) {
      expect(out.text).toContain(t.name);
      expect(out.text).toContain(t.section_id ?? t.page_id);
    }
    expect(out.text).toContain("keywords-and-abilities#Class Bonus");
  });

  test("参照先カードの名前・slug・種類を返す", () => {
    const out = run(["merlin-amethysts-glow"]);
    const refs = ctx.db
      .query(
        `SELECT c.slug, c.name, r.kind FROM card_reference r JOIN card c ON c.slug = r.to_slug
         WHERE r.from_slug = 'merlin-amethysts-glow'`,
      )
      .all()
      .map((r) => RefRow.parse(r));
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) {
      expect(out.text).toContain(r.name);
      expect(out.text).toContain(r.slug);
      expect(out.text).toContain(r.kind);
    }
    expect(out.text).toContain("MASTERY");
  });

  test("カード名が出る他カードの裁定を引用 ID つきで返す", () => {
    const out = run(["nullifying-lantern"]);
    const others = ctx.db
      .query(
        `SELECT r.cite_id FROM ruling_card rc JOIN card_ruling r ON r.ruling_id = rc.ruling_id
         WHERE rc.card_slug = 'nullifying-lantern' AND r.card_slug <> 'nullifying-lantern'`,
      )
      .all()
      .map((r) => CiteRow.parse(r).cite_id);
    expect(others).toContain("censer-of-restful-peace#ruling:2025-03-02:1");
    expect(others).toContain("relentless-hexchaser#ruling:2024-01-19:1");
    for (const id of others) expect(out.text).toContain(`[${id}]`);
  });

  test("存在しない slug は isError で、その slug と find_cards を返す。正しい slug と混ぜても同じ", () => {
    for (const slugs of [["no-such-card"], ["beguiling-coup", "no-such-card"]]) {
      const out = run(slugs);
      expect(out.isError).toBe(true);
      expect(out.count).toBe(0);
      expect(out.text).toContain("no-such-card");
      expect(out.text).toContain("find_cards");
    }
  });

  test("0 件と 6 件は isError で、1〜5 件で渡すよう返す", () => {
    const six = [
      "beguiling-coup",
      "divine-comedy",
      "fireball",
      "aella-zephyrs-hand",
      "nullifying-lantern",
      "merlin-amethysts-glow",
    ];
    for (const slugs of [[], six]) {
      const out = run(slugs);
      expect(out.isError).toBe(true);
      expect(out.count).toBe(0);
      expect(out.text).toMatch(/1[^0-9]+5/);
    }
  });

  test("2 枚ぶんを返し、count は 2", () => {
    const out = run(["beguiling-coup", "divine-comedy"]);
    expect(out.isError).toBeFalsy();
    expect(out.count).toBe(2);
    expect(out.text).toContain("Beguiling Coup");
    expect(out.text).toContain("Divine Comedy");
    expect(out.text).toContain("[beguiling-coup#ruling:2025-07-18:1]");
    expect(out.text).toContain("[game-mechanics-mastery#Divine Comedy:1]");
  });
});
