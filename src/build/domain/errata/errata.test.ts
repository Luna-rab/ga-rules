import { describe, expect, test } from "bun:test";
import { DataError } from "../errors";
import type { Card, Ruling } from "../model";
import { assertErrataApplied, findPendingErrata, parseErrata } from "./index";

function card(slug: string, effect: string): Card {
  return {
    slug,
    name: slug,
    types: ["WEAPON"],
    subtypes: [],
    classes: [],
    elements: ["NORM"],
    cost: { type: "MEMORY", value: "1" },
    level: null,
    power: null,
    life: null,
    durability: null,
    speed: null,
    effect_raw: effect,
    rule: null,
    references: null,
    legality: null,
    back: null,
  };
}

function ruling(cardSlug: string, description: string, title = "ERRATA"): Ruling {
  return {
    rulingId: 1,
    citeId: `${cardSlug}#ruling:2026-08-16:1`,
    cardSlug,
    dateAdded: "2026-08-16",
    title,
    description,
  };
}

function pending(effect: string, description: string): string[] {
  return findPendingErrata([card("c", effect)], [ruling("c", description)]).map(
    (p) => p.ruling.citeId,
  );
}

describe("parseErrata", () => {
  test.each([
    { description: "attack using -> wield", expected: { from: "attack using", to: "wield" } },
    { description: "pay 2.-> pay 3.", expected: { from: "pay 2.", to: "pay 3." } },
    { description: "Spell → Skill", expected: { from: "Spell", to: "Skill" } },
  ])("「$description」を左右に分ける", ({ description, expected }) => {
    expect(parseErrata(description)).toEqual(expected);
  });

  test.each(["Added missing speed.", "a -> b -> c", "-> b", "a ->"])(
    "「%s」は書き換えの形でないので null",
    (description) => {
      expect(parseErrata(description)).toBeNull();
    },
  );
});

describe("findPendingErrata", () => {
  test("左側が残り右側が無ければ拾う", () => {
    expect(pending("Allies can attack using this weapon.", "attack using -> wield")).toEqual([
      "c#ruling:2026-08-16:1",
    ]);
  });

  test("右側があれば拾わない", () => {
    expect(pending("Allies can wield this weapon.", "attack using -> wield")).toEqual([]);
  });

  test("左側が無ければ拾わない（Type や cost の ERRATA）", () => {
    expect(pending("Draw a card.", "Regalia Weapon -> Regalia Item")).toEqual([]);
  });

  test.each([
    // 右側は効果テキストに現れない語にする。右側があると拾わない
    { name: "曲がった引用符", effect: "can't be used", description: "can’t be used -> zzz" },
    { name: "(2) と 2", effect: "pay (2).", description: "pay 2. -> zzz" },
    {
      name: "大文字と小文字・空白",
      effect: "gets +XPOWER.",
      description: "'gets +X power.' -> zzz",
    },
    {
      name: "前後の引用符と ..",
      effect: "your opponent activates",
      description: '"your opponent.." -> zzz',
    },
  ])("$name の違いを無視して比べる", ({ effect, description }) => {
    expect(pending(effect, description)).toHaveLength(1);
  });

  test("両面カードは裏面の効果テキストも確かめる", () => {
    const { rule: _r, references: _ref, legality: _l, back: _b, ...face } = card("c", "");
    const front = card("c", "Allies can wield this weapon.");
    const out = findPendingErrata(
      [{ ...front, back: { ...face, slug: "c-back", effect_raw: "attack using this weapon" } }],
      [ruling("c", "attack using -> wield")],
    );
    expect(out.map((p) => p.ruling.citeId)).toEqual(["c#ruling:2026-08-16:1"]);
  });

  test.each([
    { effect: "Genbu gets +X LIFE.", expected: 0 },
    { effect: "Genbu gets +X life.", expected: 1 },
  ])("♥ は LIFE と読む（$effect）", ({ effect, expected }) => {
    expect(pending(effect, '"+X life" -> "+X♥"')).toHaveLength(expected);
  });

  test("題が ERRATA で始まらない裁定は見ない", () => {
    const out = findPendingErrata(
      [card("c", "attack using")],
      [ruling("c", "attack using -> wield", "")],
    );
    expect(out).toEqual([]);
  });

  // 語を消す ERRATA は、当てたあとも右側が左側の中に見つかる
  test.each([
    { effect: "sacrifice another ally you control.", expected: 1 },
    { effect: "sacrifice another ally.", expected: 0 },
  ])("語を消す ERRATA は、左側が残っていれば拾う（$effect）", ({ effect, expected }) => {
    expect(
      pending(effect, "'sacrifice another ally you control. -> sacrifice another ally.'"),
    ).toHaveLength(expected);
  });

  test.each([
    { effect: "summon a Pawn Piece Token.", expected: 1 },
    { effect: "summon a Pawn Piece token.", expected: 0 },
  ])("大文字小文字だけを変える ERRATA は、区別して比べる（$effect）", ({ effect, expected }) => {
    expect(pending(effect, "'Token' -> 'token'")).toHaveLength(expected);
  });
});

describe("assertErrataApplied", () => {
  test("当たっていない ERRATA があれば cite ID と左右を添えて DataError", () => {
    let error: unknown;
    try {
      assertErrataApplied([card("c", "attack using")], [ruling("c", "attack using -> wield")]);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(DataError);
    expect(String(error)).toContain("c#ruling:2026-08-16:1: attack using -> wield");
  });

  test("すべて当たっていれば何もしない", () => {
    expect(() =>
      assertErrataApplied([card("c", "wield")], [ruling("c", "attack using -> wield")]),
    ).not.toThrow();
  });
});
