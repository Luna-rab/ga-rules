import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Card } from "../domain/model";
import type { Relations } from "../domain/relate";
import { type IndexData, writeIndex } from "./index-writer";

let dir: string;
let outPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "index-writer-"));
  outPath = join(dir, "index.sqlite");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const PAGE_ID = "game-mechanics-damage";
const SECTION_ID = "game-mechanics-damage#General Rules";
const CLAUSE_ID = "game-mechanics-damage#General Rules:13";

const merlin: Card = {
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
  effect_raw: "Lineage Release — banish Fractured Memories to deal damage.",
  rule: [{ title: "Q", date_added: "2024-01-01", description: "A." }],
  references: [
    { kind: "RELEASE", name: "Fractured Memories", slug: "fractured-memories", direction: "TO" },
  ],
  legality: { STANDARD: { limit: 1 } },
  back: null,
};

const memories: Card = {
  slug: "fractured-memories",
  name: "Fractured Memories",
  types: ["ACTION"],
  subtypes: [],
  classes: [],
  elements: ["ARCANE"],
  cost: { type: "RESERVE", value: null },
  level: null,
  power: null,
  life: null,
  durability: null,
  speed: true,
  effect_raw: "Draw a card.",
  rule: null,
  references: null,
  legality: null,
  back: null,
};

function data(relations: Partial<Relations> = {}): IndexData {
  return {
    pages: [
      {
        pageId: PAGE_ID,
        title: "Game Mechanics - Damage",
        sections: [
          {
            sectionId: SECTION_ID,
            pageId: PAGE_ID,
            heading: "General Rules",
            kind: "heading",
            clauses: [
              {
                clauseId: CLAUSE_ID,
                sectionId: SECTION_ID,
                number: "13",
                text: "Damage is marked. Exception: Champions with Immortality will not die.",
                links: [{ pageId: PAGE_ID, sectionId: SECTION_ID }],
              },
            ],
          },
        ],
      },
    ],
    toc: [{ pageId: PAGE_ID, parentPageId: null, position: 0 }],
    terms: [
      {
        termId: 1,
        name: "Damage",
        aliases: ["Dealt Damage"],
        definitions: [{ pageId: PAGE_ID, sectionId: null }],
      },
    ],
    cards: [merlin, memories],
    rulings: [
      {
        rulingId: 1,
        citeId: "merlin-amethysts-glow#ruling:2024-01-01:1",
        cardSlug: "merlin-amethysts-glow",
        dateAdded: "2024-01-01",
        title: "Lineage",
        description: "The banished card counts as remembered for damage.",
      },
    ],
    relations: {
      clauseTerms: [{ clauseId: CLAUSE_ID, termId: 1 }],
      cardTerms: [{ cardSlug: "merlin-amethysts-glow", termId: 1 }],
      rulingTerms: [{ rulingId: 1, termId: 1 }],
      clauseCards: [{ clauseId: CLAUSE_ID, cardSlug: "fractured-memories" }],
      rulingCards: [{ rulingId: 1, cardSlug: "fractured-memories" }],
      cardReferences: [
        { fromSlug: "merlin-amethysts-glow", toSlug: "fractured-memories", kind: "RELEASE" },
      ],
      ...relations,
    },
  };
}

function open(): Database {
  return new Database(outPath, { readonly: true });
}

// 返り値が Promise で、それが失敗することを確かめる（同期の throw は通さない）。
async function rejection(p: Promise<unknown>): Promise<unknown> {
  expect(p).toBeInstanceOf(Promise);
  return p.then(
    () => "resolved",
    (e: unknown) => e,
  );
}

// Page.url・Section.url は model.ts にまだ無いので、型を変えずに足す
function withUrl<T extends object>(o: T, url: string): T {
  return { ...o, url };
}

describe("writeIndex: ページと節の URL", () => {
  test("Page.url・Section.url がそのまま rule_page.url・rule_section.url に入る", async () => {
    const base = data();
    const page = base.pages[0];
    const section = page?.sections[0];
    if (!page || !section) throw new Error("fixture が空");
    const withUrls: IndexData = {
      ...base,
      pages: [
        withUrl(
          { ...page, sections: [withUrl(section, "https://rules.gatcg.com/dir/p#general-rules")] },
          "https://rules.gatcg.com/dir/p",
        ),
      ],
    };
    await writeIndex(outPath, withUrls);
    const db = open();
    expect(db.query("SELECT page_id, url FROM rule_page").all()).toEqual([
      { page_id: PAGE_ID, url: "https://rules.gatcg.com/dir/p" },
    ]);
    expect(db.query("SELECT section_id, url FROM rule_section").all()).toEqual([
      { section_id: SECTION_ID, url: "https://rules.gatcg.com/dir/p#general-rules" },
    ]);
  });
});

describe("writeIndex: 各テーブルの行", () => {
  test("ページ・節・条文・条文のリンクを書く", async () => {
    await writeIndex(outPath, data());
    const db = open();

    expect(db.query("SELECT page_id, title FROM rule_page").all()).toEqual([
      { page_id: PAGE_ID, title: "Game Mechanics - Damage" },
    ]);
    expect(db.query("SELECT section_id, page_id, heading FROM rule_section").all()).toEqual([
      { section_id: SECTION_ID, page_id: PAGE_ID, heading: "General Rules" },
    ]);
    expect(db.query("SELECT clause_id, section_id, number, text FROM rule_clause").all()).toEqual([
      {
        clause_id: CLAUSE_ID,
        section_id: SECTION_ID,
        number: "13",
        text: "Damage is marked. Exception: Champions with Immortality will not die.",
      },
    ]);
    expect(db.query("SELECT clause_id, page_id, section_id FROM clause_link").all()).toEqual([
      { clause_id: CLAUSE_ID, page_id: PAGE_ID, section_id: SECTION_ID },
    ]);
  });

  test("用語・別名・定義を書き、ページ全体の定義は section_id が NULL", async () => {
    await writeIndex(outPath, data());
    const db = open();

    expect(db.query("SELECT term_id, name FROM term").all()).toEqual([
      { term_id: 1, name: "Damage" },
    ]);
    expect(db.query("SELECT term_id, alias FROM term_alias").all()).toEqual([
      { term_id: 1, alias: "Dealt Damage" },
    ]);
    expect(db.query("SELECT term_id, page_id, section_id FROM term_definition").all()).toEqual([
      { term_id: 1, page_id: PAGE_ID, section_id: null },
    ]);
  });

  test("カード 2 枚を書き、types・cost・legality は JSON 文字列で入る", async () => {
    await writeIndex(outPath, data());
    const db = open();

    type Row = {
      slug: string;
      name: string;
      types: string;
      subtypes: string;
      classes: string;
      elements: string;
      cost: string;
      level: number | null;
      life: number | null;
      effect_raw: string | null;
      legality: string | null;
    };
    const rows = db
      .query<Row, []>(
        "SELECT slug, name, types, subtypes, classes, elements, cost, level, life, effect_raw, legality FROM card ORDER BY slug",
      )
      .all();
    expect(rows.map((r) => r.slug)).toEqual(["fractured-memories", "merlin-amethysts-glow"]);

    const m = rows.find((r) => r.slug === "merlin-amethysts-glow")!;
    expect(typeof m.types).toBe("string");
    expect(typeof m.cost).toBe("string");
    expect(typeof m.legality).toBe("string");
    expect(JSON.parse(m.types)).toEqual(["CHAMPION"]);
    expect(JSON.parse(m.subtypes)).toEqual(["HUMAN", "MAGE"]);
    expect(JSON.parse(m.classes)).toEqual(["MAGE"]);
    expect(JSON.parse(m.elements)).toEqual(["ARCANE", "NORM"]);
    expect(JSON.parse(m.cost)).toEqual({ type: "MEMORY", value: "2" });
    expect(JSON.parse(m.legality!)).toEqual({ STANDARD: { limit: 1 } });
    expect(m.name).toBe("Merlin, Amethyst's Glow");
    expect(m.level).toBe(3);
    expect(m.life).toBe(26);
    expect(m.effect_raw).toBe(merlin.effect_raw);

    const f = rows.find((r) => r.slug === "fractured-memories")!;
    expect(JSON.parse(f.types)).toEqual(["ACTION"]);
    expect(JSON.parse(f.subtypes)).toEqual([]);
    expect(JSON.parse(f.cost)).toEqual({ type: "RESERVE", value: null });
    expect(f.level).toBeNull();
    expect(f.legality).toBeNull();
  });

  test("裁定を書く", async () => {
    await writeIndex(outPath, data());
    const db = open();

    expect(
      db
        .query("SELECT ruling_id, card_slug, date_added, title, description FROM card_ruling")
        .all(),
    ).toEqual([
      {
        ruling_id: 1,
        card_slug: "merlin-amethysts-glow",
        date_added: "2024-01-01",
        title: "Lineage",
        description: "The banished card counts as remembered for damage.",
      },
    ]);
  });

  test("結び付きを 1 件ずつ各テーブルに書く", async () => {
    await writeIndex(outPath, data());
    const db = open();

    expect(db.query("SELECT clause_id, term_id FROM clause_term").all()).toEqual([
      { clause_id: CLAUSE_ID, term_id: 1 },
    ]);
    expect(db.query("SELECT card_slug, term_id FROM card_term").all()).toEqual([
      { card_slug: "merlin-amethysts-glow", term_id: 1 },
    ]);
    expect(db.query("SELECT ruling_id, term_id FROM ruling_term").all()).toEqual([
      { ruling_id: 1, term_id: 1 },
    ]);
    expect(db.query("SELECT clause_id, card_slug FROM clause_card").all()).toEqual([
      { clause_id: CLAUSE_ID, card_slug: "fractured-memories" },
    ]);
    expect(db.query("SELECT ruling_id, card_slug FROM ruling_card").all()).toEqual([
      { ruling_id: 1, card_slug: "fractured-memories" },
    ]);
    expect(db.query("SELECT from_slug, to_slug, kind FROM card_reference").all()).toEqual([
      { from_slug: "merlin-amethysts-glow", to_slug: "fractured-memories", kind: "RELEASE" },
    ]);
  });
});

describe("writeIndex: FTS", () => {
  test("rule_clause_fts の MATCH で条文が引ける", async () => {
    await writeIndex(outPath, data());
    const db = open();

    const rows = db
      .query(
        `SELECT rule_clause.clause_id AS clause_id FROM rule_clause_fts
         JOIN rule_clause ON rule_clause.rowid = rule_clause_fts.rowid
         WHERE rule_clause_fts MATCH 'immortality'`,
      )
      .all();
    expect(rows).toEqual([{ clause_id: CLAUSE_ID }]);
  });

  test("card_fts の MATCH で名前と effect_raw からカードが引ける", async () => {
    await writeIndex(outPath, data());
    const db = open();

    const match = (q: string) =>
      db
        .query<{ slug: string }, [string]>(
          `SELECT card.slug AS slug FROM card_fts
           JOIN card ON card.rowid = card_fts.rowid
           WHERE card_fts MATCH ? ORDER BY card.slug`,
        )
        .all(q)
        .map((r) => r.slug);
    expect(match("lineage")).toEqual(["merlin-amethysts-glow"]);
    expect(match("name:fractured")).toEqual(["fractured-memories"]);
  });

  test("card_ruling_fts の MATCH で裁定が引ける", async () => {
    await writeIndex(outPath, data());
    const db = open();

    const rows = db
      .query(
        `SELECT card_ruling.ruling_id AS ruling_id FROM card_ruling_fts
         JOIN card_ruling ON card_ruling.rowid = card_ruling_fts.rowid
         WHERE card_ruling_fts MATCH 'banished'`,
      )
      .all();
    expect(rows).toEqual([{ ruling_id: 1 }]);
  });
});

describe("writeIndex: 失敗したとき", () => {
  const missing = "no-such-page#General Rules:1";

  test.each<[string, Partial<Relations>]>([
    ["clauseTerms", { clauseTerms: [{ clauseId: missing, termId: 1 }] }],
    ["clauseCards", { clauseCards: [{ clauseId: missing, cardSlug: "fractured-memories" }] }],
  ])("%s に存在しない clauseId があると失敗し、outPath は作られない", async (_name, relations) => {
    expect(await rejection(writeIndex(outPath, data(relations)))).toBeInstanceOf(Error);
    expect(existsSync(outPath)).toBe(false);
  });

  test("失敗しても、既にあった outPath のファイルは消えず中身も変わらない", async () => {
    writeFileSync(outPath, "previous index");

    const bad = data({ clauseTerms: [{ clauseId: missing, termId: 1 }] });
    expect(await rejection(writeIndex(outPath, bad))).toBeInstanceOf(Error);

    expect(existsSync(outPath)).toBe(true);
    expect(readFileSync(outPath, "utf8")).toBe("previous index");
  });
});
