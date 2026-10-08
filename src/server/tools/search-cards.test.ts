import { describe, expect, test } from "bun:test";
import { z } from "zod";
import type { ToolContext } from "../context";
import { openTestContext } from "../testing";
import { searchCards } from "./search-cards";

const ctx: ToolContext = openTestContext();
type Args = Parameters<typeof searchCards.handler>[1];
const run = (args: Args) => searchCards.handler(ctx, args);

const SlugName = z.object({ slug: z.string(), name: z.string() });
const Value = z.object({ value: z.string() });

// 期待値は索引から直に引く。ツールの出力を組み立てる側の関数は使わない。
function cards(where: string, join = ""): { slug: string; name: string }[] {
  return ctx.db
    .query(`SELECT slug, name FROM card ${join} WHERE ${where} ORDER BY name, slug`)
    .all()
    .map((r) => SlugName.parse(r));
}
const inClass = (cls: string) =>
  `EXISTS (SELECT 1 FROM json_each(card.classes) WHERE value = '${cls}')`;
const MEMORY = "json_extract(cost, '$.type') = 'memory'";
const COST = "json_extract(cost, '$.value')";

const linesOf = (text: string) => text.split("\n").filter((l) => l.trim() !== "");
const hasSlug = (line: string, slug: string) =>
  new RegExp(`(^|[^a-z0-9-])${slug}($|[^a-z0-9-])`).test(line);
const shown = (text: string, all: { slug: string }[]) =>
  all.filter((c) => linesOf(text).some((l) => hasSlug(l, c.slug))).map((c) => c.slug);
const hasNumber = (text: string, n: number) => new RegExp(`(^|[^0-9])${n}($|[^0-9])`).test(text);

describe("search_cards: カードの行に URL を付けない", () => {
  test("カードの行に https://index.gatcg.com/ が出ない", () => {
    for (const args of [{ subtype: "SHENJU" }, { class: "MAGE" }] as Args[]) {
      const out = run(args);
      expect(out.isError).toBeFalsy();
      expect(out.count).toBeGreaterThan(0);
      expect(out.text).not.toContain("https://index.gatcg.com/");
    }
  });
});

describe("search_cards: 両面カードの裏面", () => {
  test("裏面にしか無いサブタイプ SHENJU で、裏面の 4 枚が表の slug を添えて出る", () => {
    const out = run({ subtype: "SHENJU" });
    expect(out.isError).toBeFalsy();
    const line = linesOf(out.text).find((l) => hasSlug(l, "seiryuu-azure-dragon"));
    expect(line).toContain("back face of fabled-azurite-fatestone");
    expect(out.count).toBe(4);
  });

  test.each([{ legal_in: "STANDARD" }, { banned_in: "STANDARD" }])(
    "%o では、デッキに入らない裏面を外す",
    (format) => {
      const out = run({ ...format, subtype: "FATEBOUND" });
      const backs = cards("front_slug IS NOT NULL");
      expect(backs.length).toBeGreaterThan(0);
      expect(shown(out.text, backs)).toEqual([]);
      expect(out.text).not.toContain("back face of");
    },
  );

  test("text と power の条件が裏面の名前・ステータスに当たる", () => {
    const out = run({ text: "Seiryuu Azure", power_min: 4 });
    expect(linesOf(out.text).some((l) => hasSlug(l, "seiryuu-azure-dragon"))).toBe(true);
  });
});

describe("search_cards: 値の誤り", () => {
  test("element の誤りは isError で、13 種すべての値を返す", () => {
    const out = run({ element: "FLAME" });
    expect(out.isError).toBe(true);
    expect(out.count).toBe(0);
    const elements = ctx.db
      .query("SELECT DISTINCT value FROM card, json_each(card.elements)")
      .all()
      .map((r) => Value.parse(r).value);
    expect(elements.length).toBe(13);
    for (const e of elements) expect(out.text).toContain(e);
  });

  test("type・subtype・class の誤りも、その属性の正しい値の一覧を返す", () => {
    for (const [key, column, bad] of [
      ["type", "types", "NOPE"],
      ["subtype", "subtypes", "NOPE"],
      ["class", "classes", "NOPE"],
    ] as const) {
      const out = run({ [key]: bad });
      expect(out.isError).toBe(true);
      const values = ctx.db
        .query(`SELECT DISTINCT value FROM card, json_each(card.${column})`)
        .all()
        .map((r) => Value.parse(r).value);
      expect(values.length).toBeGreaterThan(0);
      for (const v of values) expect(out.text).toContain(v);
    }
  });

  test("cost_type・speed・legal_in・banned_in の誤りは、その引数の正しい値の一覧を返す", () => {
    const cases: [Args, string[]][] = [
      [{ cost_type: "mana" }, ["reserve", "memory", "none"]],
      [{ speed: "instant" }, ["fast", "slow"]],
      [{ legal_in: "MODERN" }, ["STANDARD", "PANTHEON", "DRAFT"]],
      [{ banned_in: "MODERN" }, ["STANDARD", "PANTHEON", "DRAFT"]],
    ];
    for (const [args, values] of cases) {
      const out = run(args);
      expect(out.isError).toBe(true);
      for (const v of values) expect(out.text).toContain(v);
    }
  });

  test("引数が 1 つも無いと isError で、条件を指定するよう返す", () => {
    const out = run({});
    expect(out.isError).toBe(true);
    expect(out.text).toMatch(/condition/i);
  });

  test("_min が _max より大きいと isError で、その項目名を返す", () => {
    const cases: [Args, string][] = [
      [{ cost_min: 3, cost_max: 1 }, "cost"],
      [{ level_min: 3, level_max: 1 }, "level"],
      [{ power_min: 3, power_max: 1 }, "power"],
      [{ life_min: 3, life_max: 1 }, "life"],
      [{ durability_min: 3, durability_max: 1 }, "durability"],
    ];
    for (const [args, name] of cases) {
      const out = run(args);
      expect(out.isError).toBe(true);
      expect(out.text).toContain(name);
    }
  });
});

describe("search_cards: 検索", () => {
  test("element は大文字小文字を区別せず、Exalted で elements に FIRE を含むカードも当たる", () => {
    const lower = run({ element: "fire" });
    const upper = run({ element: "FIRE" });
    expect(lower.isError).toBeFalsy();
    expect(lower.text).toBe(upper.text);
    const total = cards("EXISTS (SELECT 1 FROM json_each(card.elements) WHERE value = 'FIRE')");
    expect(hasNumber(lower.text, total.length)).toBe(true);

    // 行に出た slug はすべて elements に FIRE を持つ。class ごとに絞り、20 件以下なら集合が一致する
    const fire = cards("EXISTS (SELECT 1 FROM json_each(card.elements) WHERE value = 'FIRE')");
    const exaltedFire = cards(
      `EXISTS (SELECT 1 FROM json_each(card.elements) WHERE value = 'FIRE')
       AND EXISTS (SELECT 1 FROM json_each(card.elements) WHERE value = 'EXALTED')`,
    ).map((c) => c.slug);
    expect(exaltedFire.length).toBeGreaterThan(0);
    const types = ctx.db
      .query("SELECT DISTINCT value FROM card, json_each(card.types)")
      .all()
      .map((r) => Value.parse(r).value);
    let exaltedChecked = 0;
    for (const type of types) {
      const ofType = cards(`EXISTS (SELECT 1 FROM json_each(card.types) WHERE value = '${type}')`);
      for (const cost of ["reserve", "memory", "none"]) {
        const expected = cards(
          `EXISTS (SELECT 1 FROM json_each(card.elements) WHERE value = 'FIRE')
           AND EXISTS (SELECT 1 FROM json_each(card.types) WHERE value = '${type}')
           AND json_extract(cost, '$.type') = '${cost}'`,
        );
        const out = run({ element: "fire", type, cost_type: cost });
        const got = shown(out.text, ofType);
        for (const s of got) expect(fire.map((c) => c.slug)).toContain(s);
        if (expected.length > 0 && expected.length <= 20) {
          expect(got.toSorted()).toEqual(expected.map((c) => c.slug).toSorted());
          exaltedChecked += got.filter((s) => exaltedFire.includes(s)).length;
        }
      }
    }
    expect(exaltedChecked).toBeGreaterThan(0);
  });

  test("class: MAGE は 20 行と総件数 419 を返し、名前順に並び、条件を足すよう促す", () => {
    const mage = cards(inClass("MAGE"));
    expect(mage.length).toBe(419);
    const out = run({ class: "MAGE" });
    expect(out.isError).toBeFalsy();
    expect(out.count).toBe(20);
    expect(hasNumber(out.text, 419)).toBe(true);
    expect(out.text).toMatch(/condition/i);

    const rows = linesOf(out.text).filter((l) => mage.some((c) => hasSlug(l, c.slug)));
    expect(rows.length).toBe(20);
    const names = rows.map((l) => mage.find((c) => hasSlug(l, c.slug))?.name ?? "");
    expect(names).toEqual(names.toSorted());
    // 20 件目の名前より前の名前は、すべて出る
    const last = names[19] ?? "";
    for (const before of mage.filter((x) => x.name < last)) {
      expect(rows.some((l) => hasSlug(l, before.slug))).toBe(true);
    }
  });

  test("text: draw は 20 行を関連度順で返し、各行に当たった語の抜粋が入る", () => {
    const out = run({ text: "draw" });
    expect(out.isError).toBeFalsy();
    const all = cards("1");
    const rows = linesOf(out.text).filter((l) => all.some((c) => hasSlug(l, c.slug)));
    expect(rows.length).toBe(20);
    // 当たった語は snippet が ** で囲む（大文字小文字は元のまま）
    for (const l of rows) expect(l).toMatch(/\*\*draw/i);
    // 関連度順（bm25 の昇順、同点は name・slug）。期待する並びは索引から直に引く
    const expected = ctx.db
      .query(
        `SELECT card.slug FROM card_fts JOIN card ON card.rowid = card_fts.rowid
         WHERE card_fts MATCH '"draw"' ORDER BY bm25(card_fts), card.name, card.slug LIMIT 20`,
      )
      .all()
      .map((r) => z.object({ slug: z.string() }).parse(r).slug);
    const order = rows.map((l) => all.find((c) => hasSlug(l, c.slug))?.slug ?? "");
    expect(order).toEqual(expected);
  });

  test("cost_type: memory と cost の範囲は、コストが memory 2 のカードだけを返す", () => {
    const m2 = cards(`${MEMORY} AND ${COST} = '2' AND ${inClass("CLERIC")}`);
    expect(m2.length).toBeGreaterThan(1);
    const out = run({ cost_type: "memory", cost_min: 2, cost_max: 2, class: "CLERIC" });
    expect(out.isError).toBeFalsy();
    expect(shown(out.text, cards(inClass("CLERIC"))).toSorted()).toEqual(
      m2.map((c) => c.slug).toSorted(),
    );
    expect(out.count).toBe(m2.length);
  });

  test("cost.value が X のカードは範囲の条件で外れる", () => {
    const x = cards(`${MEMORY} AND ${COST} = 'X' AND ${inClass("CLERIC")}`);
    expect(x.length).toBeGreaterThan(0);
    const numeric = cards(`${MEMORY} AND ${COST} GLOB '[0-9]*' AND ${inClass("CLERIC")}`);
    const out = run({ cost_type: "memory", cost_min: 0, cost_max: 99, class: "CLERIC" });
    // 総件数は数値のコストを持つカードだけ。X を含めた件数ではない
    expect(hasNumber(out.text, numeric.length)).toBe(true);
    expect(hasNumber(out.text, numeric.length + x.length)).toBe(false);
  });

  test("cost.value が null のカード（cost_type: none）は範囲の条件で外れ、該当なしになる", () => {
    const none = cards(
      "json_extract(cost, '$.type') = 'none' AND json_extract(cost, '$.value') IS NULL",
    );
    expect(none.length).toBeGreaterThan(0);
    for (const args of [
      { cost_type: "none", cost_min: 0 },
      { cost_type: "none", cost_max: 99 },
    ] satisfies Args[]) {
      const out = run(args);
      expect(out.isError).toBeFalsy();
      expect(out.count).toBe(0);
      expect(shown(out.text, none)).toEqual([]);
    }
    // 範囲を付けなければ、同じカードが当たる
    const all = run({ cost_type: "none" });
    expect(all.count).toBeGreaterThan(0);
    expect(shown(all.text, none).length).toBe(all.count);
  });

  test("level・power・life・durability の範囲は、範囲内の値を持つカードだけを返す", () => {
    for (const key of ["level", "power", "life", "durability"] as const) {
      const [lo, hi] = key === "life" ? [20, 20] : [1, 1];
      const expected = cards(`${key} BETWEEN ${lo} AND ${hi}`);
      expect(expected.length).toBeGreaterThan(0);
      const out = run({ [`${key}_min`]: lo, [`${key}_max`]: hi });
      expect(out.isError).toBeFalsy();
      const got = shown(out.text, expected);
      if (expected.length <= 20)
        expect(got.toSorted()).toEqual(expected.map((c) => c.slug).toSorted());
      expect(got.length).toBe(Math.min(expected.length, 20));
      // 総件数は注記の行から取り出し、索引から引いた件数と照合する
      const note = linesOf(out.text).find((l) =>
        /^Showing \d+ of \d+ cards\.|^\d+ cards?\.$/.test(l),
      );
      const total = Number(note?.match(/of (\d+) cards/)?.[1] ?? note?.match(/^(\d+) card/)?.[1]);
      expect(total).toBe(expected.length);
    }
  });

  test("banned_in: STANDARD は limit が 0 のカードだけ、legal_in: STANDARD はそれ以外", () => {
    const banned = (cls: string) =>
      cards(`json_extract(legality, '$.STANDARD.limit') = 0 AND ${inClass(cls)}`);
    const inSpirit = cards(inClass("SPIRIT"));
    const b = run({ banned_in: "STANDARD", class: "SPIRIT" });
    expect(shown(b.text, inSpirit).toSorted()).toEqual(
      banned("SPIRIT")
        .map((c) => c.slug)
        .toSorted(),
    );

    const inAnomaly = cards(inClass("ANOMALY"));
    const bannedAnomaly = banned("ANOMALY").map((c) => c.slug);
    expect(bannedAnomaly.length).toBeGreaterThan(0);
    const l = run({ legal_in: "STANDARD", class: "ANOMALY" });
    expect(shown(l.text, inAnomaly).toSorted()).toEqual(
      inAnomaly
        .map((c) => c.slug)
        .filter((s) => !bannedAnomaly.includes(s))
        .toSorted(),
    );
  });

  test("speed: fast は speed が true のカードだけ、slow は false のカードだけ", () => {
    const spirit = cards(inClass("SPIRIT"));
    for (const [speed, flag] of [
      ["fast", 1],
      ["slow", 0],
    ] as const) {
      const expected = cards(`speed = ${flag} AND ${inClass("SPIRIT")}`).map((c) => c.slug);
      expect(expected.length).toBeGreaterThan(0);
      const out = run({ speed, class: "SPIRIT" });
      expect(shown(out.text, spirit).toSorted()).toEqual(expected.toSorted());
    }
  });

  test("text に括弧を含む語（Class Bonus (2)）を渡しても、エラーにならず 1 件以上返す", () => {
    const out = run({ text: "Class Bonus (2)" });
    expect(out.isError).toBeFalsy();
    expect(out.count).toBeGreaterThan(0);
  });

  test("text が記号だけ（--）なら isError", () => {
    const out = run({ text: "--" });
    expect(out.isError).toBe(true);
  });

  test("該当なしは isError 無しで、count は 0", () => {
    const out = run({ text: "qqqqzzzz" });
    expect(out.isError).toBeFalsy();
    expect(out.count).toBe(0);
  });
});
