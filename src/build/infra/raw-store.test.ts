import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Card } from "../domain/model";
import { readCards, readRules } from "./raw-store";

let dataDir: string;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "raw-store-"));
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

function put(rel: string, content: string): void {
  const path = join(dataDir, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

// fetch:data が書く形（CardSchema の列だけ・JSON.stringify(c, null, 2) と改行）
const card: Card = {
  slug: "merlin-amethysts-glow",
  name: "Merlin, Amethyst's Glow",
  types: ["CHAMPION"],
  subtypes: ["HUMAN", "MAGE"],
  classes: ["MAGE"],
  elements: ["ARCANE", "NORM"],
  cost: { type: "MEMORY", value: "2" },
  level: 3,
  power: null,
  life: 26,
  durability: null,
  speed: null,
  effect_raw: "Lineage Release — [Class Bonus] ...",
  rule: [{ title: "Q", date_added: "2024-01-01", description: "A." }],
  references: [
    { kind: "RELEASE", name: "Fractured Memories", slug: "crystal-mastery", direction: "TO" },
  ],
  legality: { STANDARD: { limit: 1 } },
  back: null,
};

// 返り値が Promise で、それが失敗することを確かめる（同期の throw は通さない）。
async function rejection(p: Promise<unknown>): Promise<unknown> {
  expect(p).toBeInstanceOf(Promise);
  return p.then(
    () => "resolved",
    (e: unknown) => e,
  );
}

function cardJson(c: unknown): string {
  return `${JSON.stringify(c, null, 2)}\n`;
}

describe("readRules", () => {
  test("rules の下の .md を相対パスと中身で返し、SUMMARY.md を除く", async () => {
    put("rules/a.md", "# A\n\n#### General Rules:\n\n1. one\n");
    put("rules/sub/README.md", "# Sub\n\nbody\n");
    put("rules/SUMMARY.md", "* [A](a.md)\n");

    const pages = await readRules(dataDir);

    expect(pages.toSorted((x, y) => x.path.localeCompare(y.path))).toEqual([
      { path: "a.md", markdown: "# A\n\n#### General Rules:\n\n1. one\n" },
      { path: "sub/README.md", markdown: "# Sub\n\nbody\n" },
    ]);
  });
});

describe("readCards", () => {
  test("cards/x.json の 1 枚を Card として返す", async () => {
    put("cards/x.json", cardJson(card));

    expect(await readCards(dataDir)).toEqual([card]);
  });

  test("null の列を持つカードもそのまま返す", async () => {
    const plain: Card = {
      ...card,
      slug: "plain-card",
      level: null,
      effect_raw: null,
      rule: null,
      references: null,
      legality: null,
      cost: { type: "RESERVE", value: null },
      speed: true,
    };
    put("cards/x.json", cardJson(card));
    put("cards/plain-card.json", cardJson(plain));

    const cards = await readCards(dataDir);

    expect(cards.toSorted((x, y) => x.slug.localeCompare(y.slug))).toEqual([card, plain]);
  });

  test("両面カードの裏面（back）も Card の back として返す", async () => {
    const { rule: _r, references: _ref, legality: _l, back: _b, ...face } = card;
    const doubleFaced: Card = { ...card, back: { ...face, slug: "back-face", name: "Back Face" } };
    put("cards/x.json", cardJson(doubleFaced));

    expect(await readCards(dataDir)).toEqual([doubleFaced]);
  });

  test("slug に大文字を含むと失敗する", async () => {
    put("cards/x.json", cardJson({ ...card, slug: "Merlin-Amethysts-Glow" }));

    expect(await rejection(readCards(dataDir))).toBeInstanceOf(Error);
  });

  test("必須の列が欠けると失敗する", async () => {
    const { name: _name, ...noName } = card;
    put("cards/x.json", cardJson(noName));

    expect(await rejection(readCards(dataDir))).toBeInstanceOf(Error);
  });

  test("正しいカードに混ざった 1 枚が壊れていても失敗する", async () => {
    const { elements: _elements, ...noElements } = card;
    put("cards/x.json", cardJson(card));
    put("cards/y.json", cardJson({ ...noElements, slug: "y" }));

    expect(await rejection(readCards(dataDir))).toBeInstanceOf(Error);
  });
});
