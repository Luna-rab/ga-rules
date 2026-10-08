import { describe, expect, test } from "bun:test";
import { DataError } from "./errors";
import type { Card, CardReference, Page, RawRuling, Ruling, Term } from "./model";
import { relate, toRulings } from "./relate";

function card(
  slug: string,
  name: string,
  opts: { effect?: string; rule?: RawRuling[]; references?: CardReference[] } = {},
): Card {
  return {
    slug,
    name,
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
    effect_raw: opts.effect ?? null,
    rule: opts.rule ?? null,
    references: opts.references ?? null,
    legality: null,
    back: null,
  };
}

// 1 ページ 1 節に条文を並べる。clauseId は `p#S:<番号>`
function pageWith(texts: string[]): Page {
  return {
    pageId: "p",
    title: "P",
    url: "https://rules.gatcg.com/p",
    sections: [
      {
        sectionId: "p#S",
        pageId: "p",
        heading: "S",
        kind: "heading",
        url: "https://rules.gatcg.com/p#s",
        clauses: texts.map((text, i) => ({
          clauseId: `p#S:${i + 1}`,
          sectionId: "p#S",
          number: String(i + 1),
          text,
          links: [],
        })),
      },
    ],
  };
}

function term(termId: number, name: string, aliases: string[] = []): Term {
  return { termId, name, aliases, definitions: [{ pageId: "p", sectionId: "p#S" }] };
}

function ruling(rulingId: number, cardSlug: string, description: string): Ruling {
  return {
    rulingId,
    citeId: `${cardSlug}#ruling:2024-01-01:${rulingId}`,
    cardSlug,
    dateAdded: "2024-01-01",
    title: "Q",
    description,
  };
}

function rawRuling(date_added: string): RawRuling {
  return { title: "T", date_added, description: "D." };
}

function ref(slug: string, kind = "MASTERY"): CardReference {
  return { kind, name: slug, slug, direction: "TO" };
}

describe("toRulings", () => {
  test("2 枚のカードに同じ文面の裁定が 1 件ずつあると 2 行を返し、rulingId は 1 と 2", () => {
    const same: RawRuling = {
      title: "Omen",
      date_added: "2025-06-27",
      description: "Cards in banishment with omen counters on them are omens.",
    };
    const rulings = toRulings([
      card("a-card", "A Card", { rule: [same] }),
      card("b-card", "B Card", { rule: [{ ...same, date_added: "2025-12-04" }] }),
    ]);

    expect(rulings).toHaveLength(2);
    expect(rulings.map((r) => r.rulingId).toSorted((a, b) => a - b)).toEqual([1, 2]);
    expect(rulings).toContainEqual({
      rulingId: expect.any(Number),
      citeId: expect.any(String),
      cardSlug: "a-card",
      dateAdded: "2025-06-27",
      title: "Omen",
      description: same.description,
    });
    expect(rulings).toContainEqual({
      rulingId: expect.any(Number),
      citeId: expect.any(String),
      cardSlug: "b-card",
      dateAdded: "2025-12-04",
      title: "Omen",
      description: same.description,
    });
  });

  test("citeId は取得元の順に、同じカード・同じ日付の中で 1 から数える", () => {
    const rulings = toRulings([
      card("beguiling-coup", "Beguiling Coup", {
        rule: [rawRuling("2025-07-18"), rawRuling("2025-07-18"), rawRuling("2025-06-27")],
      }),
      card("other-card", "Other Card", { rule: [rawRuling("2025-07-18")] }),
    ]);

    expect(rulings.filter((x) => x.cardSlug === "beguiling-coup").map((x) => x.citeId)).toEqual([
      "beguiling-coup#ruling:2025-07-18:1",
      "beguiling-coup#ruling:2025-07-18:2",
      "beguiling-coup#ruling:2025-06-27:1",
    ]);
    expect(rulings.find((x) => x.cardSlug === "other-card")?.citeId).toBe(
      "other-card#ruling:2025-07-18:1",
    );
  });

  test("1 枚に裁定が複数あれば全部を行にし、rule が null のカードは行を作らない", () => {
    const rulings = toRulings([
      card("a-card", "A Card", {
        rule: [
          { title: "Q1", date_added: "2024-01-01", description: "One." },
          { title: "Q2", date_added: "2024-01-02", description: "Two." },
        ],
      }),
      card("no-rule", "No Rule"),
      card("b-card", "B Card", {
        rule: [{ title: "Q3", date_added: "2024-01-03", description: "Three." }],
      }),
    ]);

    expect(rulings.map((r) => r.rulingId).toSorted((a, b) => a - b)).toEqual([1, 2, 3]);
    expect(
      rulings
        .filter((r) => r.cardSlug === "a-card")
        .map((r) => r.description)
        .toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(["One.", "Two."]);
    expect(rulings.some((r) => r.cardSlug === "no-rule")).toBe(false);
  });
});

describe("relate", () => {
  test("effect_raw に用語があるカードを cardTerms に返す", () => {
    const rel = relate({
      pages: [],
      terms: [term(1, "Class Bonus"), term(2, "Omen")],
      cards: [card("c", "Some Card", { effect: "Class Bonus: Draw." })],
      rulings: [],
    });

    expect(rel.cardTerms).toEqual([{ cardSlug: "c", termId: 1 }]);
  });

  test("条文・裁定の用語を返し、別名でも当てる", () => {
    const rel = relate({
      pages: [pageWith(["When a unit dies, put two omens into banishment.", "Draw a card."])],
      terms: [term(1, "Died", ["Dies", "Kills", "Killed"]), term(2, "Omen")],
      cards: [card("c", "Some Card")],
      rulings: [ruling(1, "c", "If it is killed, nothing happens.")],
    });

    expect(sortBy(rel.clauseTerms)).toEqual(
      sortBy([
        { clauseId: "p#S:1", termId: 1 },
        { clauseId: "p#S:1", termId: 2 },
      ]),
    );
    expect(rel.rulingTerms).toEqual([{ rulingId: 1, termId: 1 }]);
  });

  test("条文に Fractured Memories があれば clauseCards にそのカードを返す", () => {
    const rel = relate({
      pages: [pageWith(["Fractured Memories is a mastery card.", "Nothing here."])],
      terms: [],
      cards: [card("fractured-memories", "Fractured Memories")],
      rulings: [],
    });

    expect(rel.clauseCards).toEqual([{ clauseId: "p#S:1", cardSlug: "fractured-memories" }]);
  });

  test("条文のリンク先にだけある語は当てず、リンクの表示文字列の語は当てる", () => {
    const rel = relate({
      pages: [
        pageWith([
          "Put [an omen](game-mechanics-counters#Bulwark) on [Fractured Memories](cards#Nameless Champion).",
        ]),
      ],
      terms: [term(1, "Omen"), term(2, "Bulwark")],
      cards: [
        card("fractured-memories", "Fractured Memories"),
        card("nameless-champion", "Nameless Champion"),
      ],
      rulings: [],
    });

    expect(rel.clauseTerms).toEqual([{ clauseId: "p#S:1", termId: 1 }]);
    expect(rel.clauseCards).toEqual([{ clauseId: "p#S:1", cardSlug: "fractured-memories" }]);
  });

  test("裁定に出るカード名を rulingCards に返す", () => {
    const rel = relate({
      pages: [],
      terms: [],
      cards: [card("a-card", "Some Card"), card("fractured-memories", "Fractured Memories")],
      rulings: [ruling(1, "a-card", "This works with Fractured Memories.")],
    });

    expect(rel.rulingCards).toEqual([{ rulingId: 1, cardSlug: "fractured-memories" }]);
  });

  test("名前が 1 語のカードや 8 文字未満のカードは条文と裁定に当てない", () => {
    const rel = relate({
      pages: [pageWith(["Excalibur and Ash Orb are named here."])],
      terms: [],
      cards: [card("excalibur", "Excalibur"), card("ash-orb", "Ash Orb")],
      rulings: [ruling(1, "excalibur", "Excalibur and Ash Orb again.")],
    });

    expect(rel.clauseCards).toEqual([]);
    expect(rel.rulingCards).toEqual([]);
  });

  test("同じ名前のカードが複数あれば全部を当てる", () => {
    const rel = relate({
      pages: [pageWith(["Nameless Champion appears."])],
      terms: [],
      cards: [
        card("nameless-champion-a", "Nameless Champion"),
        card("nameless-champion-b", "Nameless Champion"),
      ],
      rulings: [],
    });

    expect(sortBy(rel.clauseCards)).toEqual(
      sortBy([
        { clauseId: "p#S:1", cardSlug: "nameless-champion-a" },
        { clauseId: "p#S:1", cardSlug: "nameless-champion-b" },
      ]),
    );
  });

  test("references の direction TO から cardReferences を返す", () => {
    const rel = relate({
      pages: [],
      terms: [],
      cards: [
        card("merlin-amethysts-glow", "Merlin, Amethyst's Glow", {
          references: [ref("fractured-memories", "MASTERY")],
        }),
        card("fractured-memories", "Fractured Memories"),
      ],
      rulings: [],
    });

    expect(rel.cardReferences).toEqual([
      { fromSlug: "merlin-amethysts-glow", toSlug: "fractured-memories", kind: "MASTERY" },
    ]);
  });

  test("参照先の slug のカードが無いと、元と参照先の slug を message に含む DataError", () => {
    expect(relateWithMissingReference).toThrow(DataError);
    expect(relateWithMissingReference).toThrow(/merlin-amethysts-glow/);
    expect(relateWithMissingReference).toThrow(/crystal-mastery/);
  });

  test("各結び付きの配列に同じ組が 2 度入らない", () => {
    const rel = relate({
      pages: [
        pageWith([
          "Omen, omens and another Omen. Fractured Memories, then Fractured Memories again.",
        ]),
      ],
      terms: [term(1, "Omen"), term(2, "Died", ["Dies"])],
      cards: [
        card("a-card", "Some Card", {
          effect: "Omen. Omen. When it dies or Died, omens.",
          references: [ref("fractured-memories"), ref("fractured-memories")],
        }),
        card("fractured-memories", "Fractured Memories"),
      ],
      rulings: [ruling(1, "a-card", "Omen and omens. Fractured Memories and Fractured Memories.")],
    });

    expect(rel.clauseTerms).toEqual([{ clauseId: "p#S:1", termId: 1 }]);
    expect(sortBy(rel.cardTerms)).toEqual(
      sortBy([
        { cardSlug: "a-card", termId: 1 },
        { cardSlug: "a-card", termId: 2 },
      ]),
    );
    expect(rel.rulingTerms).toEqual([{ rulingId: 1, termId: 1 }]);
    expect(rel.clauseCards).toEqual([{ clauseId: "p#S:1", cardSlug: "fractured-memories" }]);
    expect(rel.rulingCards).toEqual([{ rulingId: 1, cardSlug: "fractured-memories" }]);
    expect(rel.cardReferences).toEqual([
      { fromSlug: "a-card", toSlug: "fractured-memories", kind: "MASTERY" },
    ]);
  });
});

// merlin-amethysts-glow が、どのカードにも無い slug crystal-mastery を参照する
function relateWithMissingReference() {
  return relate({
    pages: [],
    terms: [],
    cards: [
      card("merlin-amethysts-glow", "Merlin, Amethyst's Glow", {
        references: [ref("crystal-mastery", "MASTERY")],
      }),
    ],
    rulings: [],
  });
}

function sortBy<T>(rows: T[]): T[] {
  return rows.toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
