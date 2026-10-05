import { describe, expect, test } from "bun:test";
import { DataError } from "../errors";
import type { Card, CardReference } from "../model";
import { applyCardCorrections, CORRECTIONS, type Correction } from "./index";

function card(slug: string, references: CardReference[] | null): Card {
  return {
    slug,
    name: slug,
    types: ["ACTION"],
    subtypes: [],
    classes: [],
    elements: ["NORM"],
    cost: { type: "RESERVE", value: "1" },
    level: null,
    power: null,
    life: null,
    durability: null,
    speed: false,
    effect_raw: null,
    rule: null,
    references,
    legality: null,
  };
}

const toFractured: Correction = {
  kind: "card-reference",
  cardSlug: "merlin-amethysts-glow",
  from: "crystal-mastery",
  to: "fractured-memories",
  reason: "API に crystal-mastery は無く、参照の name は Fractured Memories",
};

function thrown(fn: () => unknown): DataError {
  try {
    fn();
  } catch (e) {
    if (!(e instanceof DataError)) throw e;
    return e;
  }
  throw new Error("DataError が投げられなかった");
}

describe("applyCardCorrections", () => {
  const otherRef: CardReference = {
    kind: "SUMMON",
    name: "Spirit",
    slug: "spirit",
    direction: "TO",
  };
  const cards = (): Card[] => [
    card("merlin-amethysts-glow", [
      { kind: "MASTERY", name: "Fractured Memories", slug: "crystal-mastery", direction: "TO" },
      otherRef,
    ]),
    card("spirit", null),
    card("fractured-memories", []),
  ];

  test("参照の slug crystal-mastery を fractured-memories に直し、ほかの参照とカードは変えない", () => {
    const out = applyCardCorrections(cards(), [toFractured]);
    expect(out).toHaveLength(3);
    const merlin = out.find((c) => c.slug === "merlin-amethysts-glow");
    expect(merlin?.references).toEqual([
      { kind: "MASTERY", name: "Fractured Memories", slug: "fractured-memories", direction: "TO" },
      otherRef,
    ]);
    expect(out.find((c) => c.slug === "spirit")).toEqual(card("spirit", null));
    expect(out.find((c) => c.slug === "fractured-memories")).toEqual(
      card("fractured-memories", []),
    );
  });

  test("元の配列とカードを書き換えない", () => {
    const input = cards();
    const before = structuredClone(input);
    applyCardCorrections(input, [toFractured]);
    expect(input).toEqual(before);
  });

  test("rule-link の項目は使わず、当たらなくても DataError にしない", () => {
    const ruleLink: Correction = {
      kind: "rule-link",
      path: "nowhere.md",
      from: "nowhere.md#x",
      to: null,
      reason: "テスト",
    };
    const out = applyCardCorrections(cards(), [ruleLink, toFractured]);
    expect(out.find((c) => c.slug === "merlin-amethysts-glow")?.references?.[0]?.slug).toBe(
      "fractured-memories",
    );
  });

  test("指定の slug のカードが無い項目は、その slug を添えて DataError", () => {
    const missing: Correction = { ...toFractured, cardSlug: "no-such-card" };
    const e = thrown(() => applyCardCorrections(cards(), [missing]));
    expect(e.message).toContain("no-such-card");
  });

  test("カードはあるが from の参照が無い項目は、from を添えて DataError", () => {
    const missing: Correction = { ...toFractured, from: "no-such-ref" };
    const e = thrown(() => applyCardCorrections(cards(), [missing]));
    expect(e.message).toContain("no-such-ref");
  });

  test("references が null のカードを指す項目は DataError", () => {
    const onNull: Correction = { ...toFractured, cardSlug: "spirit", from: "x" };
    thrown(() => applyCardCorrections(cards(), [onNull]));
  });
});

describe("CORRECTIONS", () => {
  test("どの項目も reason が空でない", () => {
    expect(CORRECTIONS.length).toBeGreaterThan(0);
    for (const c of CORRECTIONS) expect(c.reason.trim()).not.toBe("");
  });

  test("card-reference は 5 件で、crystal-mastery を fractured-memories に直す", () => {
    const refs = CORRECTIONS.filter((c) => c.kind === "card-reference");
    expect(refs).toHaveLength(5);
    expect(refs.map((c) => c.cardSlug).toSorted()).toEqual(
      [
        "merlin-amethysts-glow",
        "luminous-quartz",
        "materialize-the-soul",
        "stand-before-the-queen",
        "merlin-brilliant-vestige",
      ].toSorted(),
    );
    for (const c of refs) {
      expect(c.from).toBe("crystal-mastery");
      expect(c.to).toBe("fractured-memories");
    }
  });

  // rule-link の件数は決めない（task5 が実データで見つけたものを足しうる）。既知の項目があることだけを確かめる
  test.each([
    {
      path: "glossary/game-terms.md",
      from: "game-terms.md#negated",
      to: { pageId: "game-terms", sectionId: "game-terms#Negated" },
    },
    {
      path: "general-rules/general-rules-card-types/card-types-supertypes.md",
      from: "../general-rules-card-characteristics/#changing-characteristics-type-overwriting-and-type-setting",
      to: {
        pageId: "general-rules-card-characteristics",
        sectionId: "general-rules-card-characteristics#Type-Overwriting and Type-setting",
      },
    },
    {
      path: "game-mechanics/game-mechanics-types-of-effects/types-of-effects-continuous-effects/README.md",
      from: "../../../glossary/game-terms.md#have-gain-get-become-are",
      to: null,
    },
    {
      path: "game-mechanics/game-mechanics-types-of-effects/types-of-effects-continuous-effects/README.md",
      from: "/broken/pages/d5fQPRV40fjs6PztDRCI",
      to: {
        pageId: "general-rules-card-characteristics",
        sectionId: "general-rules-card-characteristics#General Rules",
      },
    },
  ])("rule-link $from があり、path と to が合う", ({ path, from, to }) => {
    const hits = CORRECTIONS.filter((c) => c.kind === "rule-link" && c.from === from);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ kind: "rule-link", path, from, to });
  });

  test("CORRECTIONS の card-reference は、該当する参照を持つカードに当てると全部当たる", () => {
    const slugs = CORRECTIONS.filter((c) => c.kind === "card-reference").map((c) => c.cardSlug);
    const input = [
      ...slugs.map((s) =>
        card(s, [
          { kind: "MASTERY", name: "Fractured Memories", slug: "crystal-mastery", direction: "TO" },
        ]),
      ),
      card("fractured-memories", []),
    ];
    const out = applyCardCorrections(input, CORRECTIONS);
    for (const s of slugs) {
      expect(out.find((c) => c.slug === s)?.references?.[0]?.slug).toBe("fractured-memories");
    }
  });
});
