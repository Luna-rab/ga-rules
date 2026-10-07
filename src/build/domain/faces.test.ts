import { describe, expect, test } from "bun:test";
import { DataError } from "./errors";
import { toCardRows } from "./faces";
import type { Card, CardFace } from "./model";

function face(slug: string): CardFace {
  return {
    slug,
    name: slug,
    types: ["ALLY"],
    subtypes: [],
    classes: [],
    elements: ["ARCANE"],
    cost: { type: "reserve", value: "2" },
    level: null,
    power: 3,
    life: 3,
    durability: null,
    speed: null,
    effect_raw: null,
  };
}

function card(slug: string, back: CardFace | null): Card {
  return {
    ...face(slug),
    types: ["REGALIA", "ITEM"],
    rule: null,
    references: null,
    legality: { STANDARD: { limit: 0 } },
    back,
  };
}

describe("toCardRows", () => {
  test("表をすべて並べてから裏面を並べ、裏面は表の slug と禁止を持つ", () => {
    const rows = toCardRows([card("a", face("a-back")), card("b", null)]);
    expect(rows.map((r) => [r.slug, r.frontSlug])).toEqual([
      ["a", null],
      ["b", null],
      ["a-back", "a"],
    ]);
    expect(rows[2]).toMatchObject({ types: ["ALLY"], legality: { STANDARD: { limit: 0 } } });
  });

  test("行に rule・references・back を持ち込まない", () => {
    const [row] = toCardRows([card("a", face("a-back"))]);
    expect(row).not.toHaveProperty("rule");
    expect(row).not.toHaveProperty("back");
  });

  test("裏面の slug がほかのカードと重なれば、その slug を添えて DataError", () => {
    expect(() => toCardRows([card("a", face("b")), card("b", null)])).toThrow(DataError);
  });
});
