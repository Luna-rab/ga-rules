import { describe, expect, test } from "bun:test";
import { z } from "zod";
import type { ToolContext } from "../context";
import { openTestContext } from "../testing";
import { findCards } from "./find-cards";

const SlugRow = z.object({ slug: z.string() });

const ctx: ToolContext = openTestContext();
const run = (name: string) => findCards.handler(ctx, { name });
const linesOf = (text: string) => text.split("\n").filter((l) => l.trim() !== "");
const hasSlug = (line: string, slug: string) =>
  new RegExp(`(^|[^a-z0-9-])${slug}($|[^a-z0-9-])`).test(line);

describe("find_cards", () => {
  test("Aella は Aella, Zephyr's Hand を名前と slug 付きで返す", () => {
    const out = run("Aella");
    expect(out.isError).toBeFalsy();
    expect(out.text).toContain("Aella, Zephyr's Hand");
    expect(out.text).toContain("aella-zephyrs-hand");
    expect(out.count).toBeGreaterThan(0);
  });

  test("綴りの誤り Beguilling Coup は beguiling-coup を 1 行目に返す", () => {
    const out = run("Beguilling Coup");
    expect(out.isError).toBeFalsy();
    const lines = linesOf(out.text);
    expect(lines.length).toBeLessThanOrEqual(10);
    expect(hasSlug(lines[0] ?? "", "beguiling-coup")).toBe(true);
  });

  test("語の切れ目の誤り Fire Ball は Fireball を返し、10 行以下", () => {
    const out = run("Fire Ball");
    expect(out.isError).toBeFalsy();
    expect(linesOf(out.text).some((l) => hasSlug(l, "fireball"))).toBe(true);
    expect(linesOf(out.text).length).toBeLessThanOrEqual(10);
  });

  test("同名の Nameless Champion は slug で見分けられる形で複数返す", () => {
    const same = ctx.db
      .query("SELECT slug FROM card WHERE name = 'Nameless Champion'")
      .all()
      .map((r) => SlugRow.parse(r).slug);
    expect(same.length).toBeGreaterThan(10);

    const out = run("Nameless Champion");
    const lines = linesOf(out.text);
    expect(lines.length).toBeLessThanOrEqual(10);
    const found = same.filter((s) => lines.some((l) => hasSlug(l, s)));
    expect(found.length).toBeGreaterThan(1);
    // 1 行 1 枚。行ごとに別の slug で見分けられる
    for (const l of lines) expect(same.filter((s) => hasSlug(l, s)).length).toBe(1);
    expect(out.count).toBe(lines.length);
  });

  test("該当なしは isError 無しで、count が 0", () => {
    const out = run("qqqqzzzz");
    expect(out.isError).toBeFalsy();
    expect(out.count).toBe(0);
    expect(out.text.length).toBeGreaterThan(0);
    // 該当なしだけを返す。カードの行は 1 つも無い
    expect(out.text.length).toBeLessThan(200);
  });
});
