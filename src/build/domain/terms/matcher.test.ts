import { describe, expect, test } from "bun:test";
import { Matcher } from ".";

function sorted(keys: string[]): string[] {
  return keys.toSorted((a, b) => a.localeCompare(b));
}

function elements(): Matcher<string> {
  return new Matcher([
    { key: "Element", names: ["Element"] },
    { key: "Element Bonus", names: ["Element Bonus"] },
  ]);
}

describe("Matcher", () => {
  test("長い名前を先に当て、当たった範囲に短い名前を当てない", () => {
    expect(elements().match("gains element bonus")).toEqual(["Element Bonus"]);
  });

  test("長い名前から渡しても同じく Element Bonus だけが当たる", () => {
    const m = new Matcher([
      { key: "Element Bonus", names: ["Element Bonus"] },
      { key: "Element", names: ["Element"] },
    ]);
    expect(m.match("gains element bonus")).toEqual(["Element Bonus"]);
  });

  test("長い名前が当たった範囲の外にある短い名前は当てる", () => {
    expect(sorted(elements().match("Element Bonus applies to each element you control"))).toEqual([
      "Element",
      "Element Bonus",
    ]);
  });

  test("単語境界を付ける: Elemental に Element は当たらない", () => {
    expect(elements().match("Elemental")).toEqual([]);
  });

  test("末尾 s の複数形も当てる: two omens に Omen", () => {
    const m = new Matcher([{ key: "Omen", names: ["Omen"] }]);
    expect(m.match("two omens")).toEqual(["Omen"]);
  });

  test("大文字小文字を無視する: ATTACK に Attack", () => {
    const m = new Matcher([{ key: "Attack", names: ["Attack"] }]);
    expect(m.match("ATTACK")).toEqual(["Attack"]);
  });

  test("別名でも当て、同じキーは 1 度だけ返す", () => {
    const m = new Matcher([
      { key: 1, names: ["Activate", "Activating"] },
      { key: 2, names: ["Omen"] },
    ]);
    expect(m.match("Activating an omen. Activate another Omen.").toSorted((a, b) => a - b)).toEqual([1, 2]);
  });

  test("当たる名前が無ければ空", () => {
    const m = new Matcher([{ key: "Omen", names: ["Omen"] }]);
    expect(m.match("Draw a card.")).toEqual([]);
  });
});
