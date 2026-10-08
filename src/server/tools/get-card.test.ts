import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { openContext, type ToolContext } from "../context";
import { rewriteRuleLinks } from "../render/rule-links";
import { openTestContext } from "../testing";
import { unrewrittenLinks } from "../tests/links";
import { getCard } from "./get-card";

const ctx: ToolContext = openTestContext();
const run = (slugs: string[]) => getCard.handler(ctx, { slugs });
const list = (json: string) => z.array(z.string()).parse(JSON.parse(json)).join(", ");

const CardRow = z.object({ name: z.string(), effect_raw: z.string().nullable() });
const RulingRow = z.object({ cite_id: z.string(), description: z.string() });
const TermRow = z.object({
  name: z.string(),
  page_id: z.string(),
  section_id: z.string().nullable(),
});
const ClauseRow = z.object({ clause_id: z.string(), text: z.string() });
const RefRow = z.object({ slug: z.string(), name: z.string(), kind: z.string() });
const CiteRow = z.object({ cite_id: z.string(), description: z.string() });
const StoredRow = z.object({
  types: z.string(),
  subtypes: z.string(),
  classes: z.string(),
  elements: z.string(),
  cost: z.string().nullable(),
  level: z.number().nullable(),
  power: z.number().nullable(),
  life: z.number().nullable(),
  durability: z.number().nullable(),
  speed: z.number().nullable(),
  legality: z.string().nullable(),
});

describe("get_card: 両面カード", () => {
  test("表の slug では、裏面の名前・種別・ステータス・効果テキストも返す", () => {
    const out = run(["fabled-azurite-fatestone"]);
    expect(out.text).toContain(
      "### Back face: Seiryuu, Azure Dragon (seiryuu-azure-dragon) (https://index.gatcg.com/card/seiryuu-azure-dragon)",
    );
    expect(out.text).toContain("- Types: ALLY");
    expect(out.text).toContain("cost reserve 10, power 4, life 12");
    expect(out.text).toContain("Empower X+2");
  });

  test("裏面の slug では、表の名前と slug、表に付いた裁定・参照先・禁止を返す", () => {
    const out = run(["seiryuu-azure-dragon"]);
    expect(out.isError).toBeFalsy();
    expect(out.text).toContain(
      "- Back face of: Fabled Azurite Fatestone (fabled-azurite-fatestone)",
    );
    expect(out.text).toContain("[fabled-azurite-fatestone#ruling:2025-03-02:3]");
    expect(out.text).toContain("- Arcane Blast (arcane-blast) — GENERATE");
    expect(out.text).toContain("STANDARD limit 0");
  });

  test("表の裁定が裏面の名前に触れていても、ほかのカードの裁定として重ねて出さない", () => {
    // 実データに裏面の名前に触れる表の裁定が無いので、索引の写しに結び付けを 1 行足して確かめる
    const dir = mkdtempSync(join(tmpdir(), "get-card-"));
    const copy = join(dir, "index.sqlite");
    copyFileSync(ctx.db.filename, copy);
    try {
      const db = new Database(copy);
      db.run(
        `INSERT INTO ruling_card (ruling_id, card_slug)
         SELECT ruling_id, 'seiryuu-azure-dragon' FROM card_ruling WHERE cite_id = ?`,
        ["fabled-azurite-fatestone#ruling:2025-03-02:3"],
      );
      db.close();
      const out = getCard.handler(openContext(copy), { slugs: ["seiryuu-azure-dragon"] });
      expect(out.text.split("[fabled-azurite-fatestone#ruling:2025-03-02:3]")).toHaveLength(2);
      expect(out.text).not.toContain("Rulings on other cards");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("表の ERRATA は裏面の効果テキストにも当たっている（Huaji of Abyssal Fall）", () => {
    const out = run(["huaji-of-abyssal-fall"]);
    expect(out.text).toContain("can wield this weapon");
    expect(out.text).not.toContain("can attack using this weapon");
  });
});

describe("get_card: カードと裁定の URL", () => {
  const FRONT = "https://index.gatcg.com/card/fabled-azurite-fatestone";
  const BACK = "https://index.gatcg.com/card/seiryuu-azure-dragon";
  const RULING = "fabled-azurite-fatestone#ruling:2025-03-02:3";

  test("表の slug では、先頭行がカード名・slug・表の URL、裏面の見出しは裏面自身の URL", () => {
    const lines = run(["fabled-azurite-fatestone"]).text.split("\n");
    expect(lines[0]).toBe(`## Fabled Azurite Fatestone (fabled-azurite-fatestone) (${FRONT})`);
    expect(lines).toContain(
      `### Back face: Seiryuu, Azure Dragon (seiryuu-azure-dragon) (${BACK})`,
    );
  });

  test("裏面の slug では、先頭の見出しが裏面自身の URL で、表に付いた裁定は表の URL", () => {
    const lines = run(["seiryuu-azure-dragon"]).text.split("\n");
    expect(lines[0]).toBe(`## Seiryuu, Azure Dragon (seiryuu-azure-dragon) (${BACK})`);
    const ruling = lines.find((l) => l.startsWith(`[${RULING}]`));
    expect(ruling).toStartWith(`[${RULING}](${FRONT}) `);
    expect(lines.some((l) => l.includes(FRONT) && l.startsWith("##"))).toBe(false);
  });

  test("通常のカードの先頭行は ## 名前 (slug) (カード URL)、裁定の行は表の URL を付ける", () => {
    const out = run(["beguiling-coup"]);
    expect(out.text.split("\n")[0]).toBe(
      "## Beguiling Coup (beguiling-coup) (https://index.gatcg.com/card/beguiling-coup)",
    );
    expect(out.text).toContain(
      "[beguiling-coup#ruling:2025-07-18:1](https://index.gatcg.com/card/beguiling-coup) ",
    );
  });

  test("他のカードの裁定は、その裁定が付いたカードの URL を付ける", () => {
    const out = run(["nullifying-lantern"]);
    expect(out.text).toContain(
      "[censer-of-restful-peace#ruling:2025-03-02:1](https://index.gatcg.com/card/censer-of-restful-peace) ",
    );
  });
});

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
    expect(out.text.split("\n")).toContainEqual(
      expect.stringMatching(
        /^\[game-mechanics-mastery#Divine Comedy:1\]\(https:\/\/rules\.gatcg\.com\/[^)\s]*\) Divine Comedy is a Mage/,
      ),
    );
    const clauses = ctx.db
      .query(
        `SELECT c.clause_id, c.text, s.url FROM clause_card cc
         JOIN rule_clause c ON c.clause_id = cc.clause_id
         JOIN rule_section s ON s.section_id = c.section_id
         WHERE cc.card_slug = 'divine-comedy'`,
      )
      .all()
      .map((r) => ClauseRow.extend({ url: z.string() }).parse(r));
    expect(clauses.length).toBeGreaterThan(0);
    for (const c of clauses) {
      expect(out.text).toContain(`[${c.clause_id}](${c.url}) `);
      const text = rewriteRuleLinks(c.text, ctx.catalog.ruleUrls);
      for (const line of text.split("\n").filter((l) => l.trim() !== "")) {
        expect(out.text).toContain(line.trim());
      }
    }
  });

  test("Divine Comedy の条文の本文のリンクは [文言](URL) [target] に書き換わる", () => {
    const out = run(["divine-comedy"]);
    const row = ctx.db
      .query("SELECT url FROM rule_section WHERE section_id = 'keywords-and-abilities#Cascade'")
      .get();
    const url = z.object({ url: z.string() }).parse(row).url;
    expect(out.text).toContain(`[cascades](${url}) [keywords-and-abilities#Cascade]`);
    expect(unrewrittenLinks(out.text)).toEqual([]);
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
      const id = t.section_id ?? t.page_id;
      const row =
        t.section_id === null
          ? ctx.db.query("SELECT url FROM rule_page WHERE page_id = ?").get(t.page_id)
          : ctx.db.query("SELECT url FROM rule_section WHERE section_id = ?").get(t.section_id);
      const url = z.object({ url: z.string() }).parse(row).url;
      expect(out.text).toContain(t.name);
      expect(out.text).toContain(`[${id}](${url})`);
    }
    expect(out.text).toMatch(
      /\[keywords-and-abilities#Class Bonus\]\(https:\/\/rules\.gatcg\.com\/[^)\s]*\)/,
    );
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
        `SELECT r.cite_id, r.description FROM ruling_card rc JOIN card_ruling r ON r.ruling_id = rc.ruling_id
         WHERE rc.card_slug = 'nullifying-lantern' AND r.card_slug <> 'nullifying-lantern'`,
      )
      .all()
      .map((r) => CiteRow.parse(r));
    expect(others.map((o) => o.cite_id)).toContain("censer-of-restful-peace#ruling:2025-03-02:1");
    expect(others.map((o) => o.cite_id)).toContain("relentless-hexchaser#ruling:2024-01-19:1");
    for (const o of others) {
      expect(out.text).toContain(`[${o.cite_id}]`);
      expect(out.text).toContain(o.description.trim());
    }
  });

  test("保存した列（種類・サブタイプ・クラス・属性・コスト・数値・速度・制限）を返す", () => {
    const slugs = ["beguiling-coup", "nameless-champion-ac", "fireball", "merlin-amethysts-glow"];
    for (const slug of slugs) {
      const row = StoredRow.parse(ctx.db.query("SELECT * FROM card WHERE slug = ?").get(slug));
      const out = run([slug]).text;
      for (const [label, json] of [
        ["Types", row.types],
        ["Subtypes", row.subtypes],
        ["Classes", row.classes],
        ["Elements", row.elements],
      ] as const) {
        if (list(json) !== "") expect(out).toContain(`- ${label}: ${list(json)}`);
      }
      const cost =
        row.cost === null
          ? null
          : z
              .object({ type: z.string().nullable(), value: z.string().nullable() })
              .parse(JSON.parse(row.cost));
      if (cost?.type)
        expect(out).toContain(`cost ${cost.type}${cost.value === null ? "" : ` ${cost.value}`}`);
      for (const key of ["level", "power", "life", "durability"] as const) {
        if (row[key] !== null) expect(out).toContain(`${key} ${row[key]}`);
        else expect(out).not.toMatch(new RegExp(`(^|[ ,])${key} \\d`, "m"));
      }
      if (row.speed !== null) expect(out).toContain(row.speed ? "fast" : "slow");
      if (row.legality !== null) {
        const leg = z
          .record(z.string(), z.object({ limit: z.number().nullable() }))
          .parse(JSON.parse(row.legality));
        for (const [f, v] of Object.entries(leg)) expect(out).toContain(`${f} limit ${v.limit}`);
      }
    }
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
