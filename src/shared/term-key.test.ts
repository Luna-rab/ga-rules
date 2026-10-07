import { describe, expect, test } from "bun:test";
import { looseKey, termKey } from "./term-key";

describe("termKey", () => {
  test.each([
    ["Ranged N", "Ranged"],
    ["Memory N+", "Memory"],
    ["Level (N)", "Level"],
    ["Lineage (term)", "Lineage"],
    ["Floating-Memory", "floating memory"],
    ["True   Sight", "True Sight"],
    ["Buff Counters", "Buff"],
    ["Counter", "Counters"],
    ["allies", "Ally"],
    ["Taunts", "Taunt"],
    ["Status", "Statuses"],
    ["Class Bonus", "Class Bonuses"],
  ])("%s と %s は同じキー", (a, b) => {
    expect(termKey(a)).toBe(termKey(b));
  });

  test.each([
    ["Load", "Loaded"],
    ["Negate", "Negated"],
    ["Link", "Linked"],
    ["States", "Stats"],
  ])("%s と %s は別のキー", (a, b) => {
    expect(termKey(a)).not.toBe(termKey(b));
  });
});

describe("looseKey", () => {
  test.each([
    ["Imbued", "Imbue"],
    ["Negated", "Negate"],
    ["Deleveling", "Delevel"],
    ["Recollection", "Recollection Phase"],
  ])("%s と %s は同じキー", (a, b) => {
    expect(looseKey(a)).toBe(looseKey(b));
  });

  test("States と Stats は別のキー", () => {
    expect(looseKey("States")).not.toBe(looseKey("Stats"));
  });
});
