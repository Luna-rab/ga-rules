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

const hasNumber = (text: string, n: number) => new RegExp(`(^|[^0-9])${n}($|[^0-9])`).test(text);

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
    // カードの行は slug を含む行。打ち切りの注記の行は数えない
    const lines = linesOf(out.text);
    const cardLines = lines.filter((l) => same.some((s) => hasSlug(l, s)));
    const noteLines = lines.filter((l) => !cardLines.includes(l));
    expect(cardLines.length).toBeGreaterThan(1);
    expect(cardLines.length).toBeLessThanOrEqual(10);
    // 1 行 1 枚。行ごとに別の slug で見分けられる
    for (const l of cardLines) expect(same.filter((s) => hasSlug(l, s)).length).toBe(1);
    expect(out.count).toBe(cardLines.length);
    // 10 枚で打ち切ったので、総件数を書いた注記が 1 行だけ付く
    expect(noteLines.length).toBe(1);
    expect(hasNumber(noteLines[0] ?? "", same.length)).toBe(true);
  });

  test("Zephyrs Hand と Zephyr's Hand は、どちらも aella-zephyrs-hand を返す", () => {
    for (const name of ["Zephyrs Hand", "Zephyr's Hand"]) {
      const out = run(name);
      expect(out.isError).toBeFalsy();
      expect(linesOf(out.text).some((l) => hasSlug(l, "aella-zephyrs-hand"))).toBe(true);
    }
  });

  test("打ち切らない呼び出しと該当なしには、注記の行が付かない", () => {
    for (const name of ["Aella", "Beguilling Coup", "Fire Ball", "qqqqzzzz"]) {
      const out = run(name);
      expect(out.text).not.toContain("Showing");
      if (name !== "qqqqzzzz") expect(linesOf(out.text).length).toBe(out.count);
    }
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
