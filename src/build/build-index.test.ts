import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { buildIndex } from "./build-index";
import { DataError } from "./domain/errors";
import type { Card } from "./domain/model";

let dir: string;
let dataDir: string;
let outPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "build-index-"));
  dataDir = join(dir, "data");
  outPath = join(dir, "index.sqlite");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function put(rel: string, content: string): void {
  const path = join(dataDir, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function card(slug: string, references: Card["references"]): Card {
  return {
    slug,
    name: slug,
    types: ["ACTION"],
    subtypes: [],
    classes: [],
    elements: ["ARCANE"],
    cost: { type: "RESERVE", value: "1" },
    level: null,
    power: null,
    life: null,
    durability: null,
    speed: false,
    effect_raw: "Draw a card.",
    rule: null,
    references,
    legality: null,
  };
}

// CORRECTIONS の項目は、当たる相手が無いと DataError になる。リンクの検査まで届くよう、
// 全項目が当たるカードとページを置く
const CARD_REFERENCE_SLUGS = [
  "merlin-amethysts-glow",
  "luminous-quartz",
  "materialize-the-soul",
  "stand-before-the-queen",
  "merlin-brilliant-vestige",
];

// 概要の 5 ページ。ページ ID はファイル名から決まる
const OVERVIEW_PAGES = [
  "general-rules/general-rules-objectives.md",
  "game-mechanics/game-mechanics-turn-order.md",
  "general-rules/general-rules-starting-the-game.md",
  "game-mechanics/game-mechanics-game-zones.md",
  "general-rules/general-rules-card-types/README.md",
];

const SUMMARY = `# Table of contents

* [Changelog](README.md)
* [Table of Contents](table-of-contents.md)
* [General Rules - Objectives](general-rules/general-rules-objectives.md)
* [General Rules - Starting the Game](general-rules/general-rules-starting-the-game.md)
* [General Rules - Card Types](general-rules/general-rules-card-types/README.md)
  * [Card Types - Supertypes](general-rules/general-rules-card-types/card-types-supertypes.md)
* [General Rules - Card Characteristics](general-rules/general-rules-card-characteristics/README.md)
* [Game Mechanics - Turn Order](game-mechanics/game-mechanics-turn-order.md)
  * [Game Mechanics - Game Zones](game-mechanics/game-mechanics-game-zones.md)
  * [Game Mechanics - Damage](game-mechanics/game-mechanics-damage.md)
    * [Types of Effects - Continuous Effects](game-mechanics/game-mechanics-types-of-effects/types-of-effects-continuous-effects/README.md)
* [Game Terms](glossary/game-terms.md)
* [Game Mechanics - Mastery](game-mechanics/game-mechanics-mastery.md)
`;

const DAMAGE_PAGE = "rules/game-mechanics/game-mechanics-damage.md";
const DAMAGE_HEAD = "# Game Mechanics - Damage\n\n#### General Rules:\n\n1. Damage is dealt.\n";

function putValidData(): void {
  put("source.json", "{}\n");
  put("rules/SUMMARY.md", SUMMARY);
  for (const path of OVERVIEW_PAGES) {
    const id = path
      .replace(/\/README\.md$/, "")
      .replace(/^.*\//, "")
      .replace(/\.md$/, "");
    put(`rules/${path}`, `# ${id}\n\n#### General Rules\n\n1. Text of ${id}.\n`);
  }
  for (const slug of CARD_REFERENCE_SLUGS) {
    put(
      `cards/${slug}.json`,
      `${JSON.stringify(
        card(slug, [
          { kind: "MASTERY", name: "Fractured Memories", slug: "crystal-mastery", direction: "TO" },
        ]),
      )}\n`,
    );
  }
  put("cards/fractured-memories.json", `${JSON.stringify(card("fractured-memories", null))}\n`);

  put(
    "rules/glossary/game-terms.md",
    "# Game Terms\n\n#### Negated&#x20;\n\n1. An effect that is negated does nothing. See [negated](game-terms.md#negated).\n",
  );
  put(
    "rules/general-rules/general-rules-card-characteristics/README.md",
    "# General Rules - Card Characteristics\n\n#### General Rules\n\n1. Cards have characteristics.\n\n#### Type-Overwriting and Type-setting\n\n1. Some effects set types.\n",
  );
  put(
    "rules/general-rules/general-rules-card-types/card-types-supertypes.md",
    "# Card Types - Supertypes\n\n#### General Rules\n\n1. See [type-setting](../general-rules-card-characteristics/#changing-characteristics-type-overwriting-and-type-setting).\n",
  );
  put(
    "rules/game-mechanics/game-mechanics-types-of-effects/types-of-effects-continuous-effects/README.md",
    "# Types of Effects - Continuous Effects\n\n#### General Rules\n\n1. Objects can gain abilities. See [here](../../../glossary/game-terms.md#have-gain-get-become-are).\n2. Effects change [characteristics](/broken/pages/d5fQPRV40fjs6PztDRCI).\n",
  );
  put(
    "rules/game-mechanics/game-mechanics-mastery.md",
    "# Game Mechanics - Mastery\n\n#### General Rules\n\n1. Each page is a mastery, as shown below.\n",
  );
  put(DAMAGE_PAGE, DAMAGE_HEAD);
}

describe("buildIndex", () => {
  test("リンク先の節が無いリンクが無ければ outPath に index.sqlite を書く", async () => {
    putValidData();

    await buildIndex({ dataDir, outPath });

    expect(existsSync(outPath)).toBe(true);
  });

  test("リンク先の節が無いリンクを 1 本足すと DataError で失敗し、outPath は作られない", async () => {
    putValidData();
    put(DAMAGE_PAGE, `${DAMAGE_HEAD}2. See [nowhere](game-mechanics-damage.md#no-such-section).\n`);

    const error = await buildIndex({ dataDir, outPath }).then(
      () => "resolved",
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(DataError);
    if (!(error instanceof DataError)) throw error;
    expect(error.message).toContain("no-such-section");
    expect(existsSync(outPath)).toBe(false);
  });

  test("概要の 5 ページのうち general-rules-objectives を欠くと DataError で失敗し、outPath は作られない", async () => {
    putValidData();
    rmSync(join(dataDir, "rules/general-rules/general-rules-objectives.md"));
    put(
      "rules/SUMMARY.md",
      SUMMARY.replace(
        "* [General Rules - Objectives](general-rules/general-rules-objectives.md)\n",
        "",
      ),
    );

    const error = await buildIndex({ dataDir, outPath }).then(
      () => "resolved",
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(DataError);
    if (!(error instanceof DataError)) throw error;
    expect(error.message).toContain("general-rules-objectives");
    expect(existsSync(outPath)).toBe(false);
  });

  test("目次に無いページがデータにあると DataError で失敗し、outPath は作られない", async () => {
    putValidData();
    put("rules/glossary/extra-page.md", "# Extra\n\n#### General Rules\n\n1. Extra.\n");

    const error = await buildIndex({ dataDir, outPath }).then(
      () => "resolved",
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(DataError);
    expect(existsSync(outPath)).toBe(false);
  });
});

async function build(): Promise<Database> {
  putValidData();
  await buildIndex({ dataDir, outPath });
  return new Database(outPath, { readonly: true });
}

describe("buildIndex: 書いた index.sqlite の形", () => {
  test("rule_page に body 列が無く、parent_page_id と position がある", async () => {
    const db = await build();
    const columns = db
      .query<{ name: string }, []>("PRAGMA table_info(rule_page)")
      .all()
      .map((c) => c.name);

    expect(columns).not.toContain("body");
    expect(columns).toContain("parent_page_id");
    expect(columns).toContain("position");
  });

  test("rule_page の親子と position は SUMMARY.md を上から読んだ順で、Changelog と目次は入らない", async () => {
    const db = await build();
    const rows = db
      .query<{ page_id: string; parent_page_id: string | null; position: number }, []>(
        "SELECT page_id, parent_page_id, position FROM rule_page ORDER BY position",
      )
      .all();

    expect(rows).toEqual([
      { page_id: "general-rules-objectives", parent_page_id: null, position: 0 },
      { page_id: "general-rules-starting-the-game", parent_page_id: null, position: 1 },
      { page_id: "general-rules-card-types", parent_page_id: null, position: 2 },
      { page_id: "card-types-supertypes", parent_page_id: "general-rules-card-types", position: 3 },
      { page_id: "general-rules-card-characteristics", parent_page_id: null, position: 4 },
      { page_id: "game-mechanics-turn-order", parent_page_id: null, position: 5 },
      {
        page_id: "game-mechanics-game-zones",
        parent_page_id: "game-mechanics-turn-order",
        position: 6,
      },
      {
        page_id: "game-mechanics-damage",
        parent_page_id: "game-mechanics-turn-order",
        position: 7,
      },
      {
        page_id: "types-of-effects-continuous-effects",
        parent_page_id: "game-mechanics-damage",
        position: 8,
      },
      { page_id: "game-terms", parent_page_id: null, position: 9 },
      { page_id: "game-mechanics-mastery", parent_page_id: null, position: 10 },
    ]);
  });

  test("rule_section の position はページの中で 0, 1 と並ぶ", async () => {
    const db = await build();
    const rows = db
      .query<{ heading: string; position: number }, []>(
        "SELECT heading, position FROM rule_section WHERE page_id = 'general-rules-card-characteristics' ORDER BY position",
      )
      .all();

    expect(rows).toEqual([
      { heading: "General Rules", position: 0 },
      { heading: "Type-Overwriting and Type-setting", position: 1 },
    ]);
  });

  test("rule_clause の position は節の中で 0, 1 と並ぶ", async () => {
    const db = await build();
    const rows = db
      .query<{ number: string; position: number }, []>(
        "SELECT number, position FROM rule_clause WHERE section_id LIKE 'types-of-effects-continuous-effects#%' ORDER BY position",
      )
      .all();

    expect(rows).toEqual([
      { number: "1", position: 0 },
      { number: "2", position: 1 },
    ]);
  });

  test("card_ruling.cite_id は UNIQUE で、同じ cite_id の行は 2 行入らない", async () => {
    const db = await build();
    const writable = new Database(outPath);
    writable.run("PRAGMA foreign_keys = ON");
    const insert = (id: number) =>
      writable
        .query(
          "INSERT INTO card_ruling (ruling_id, card_slug, date_added, title, description, cite_id) VALUES (?, 'fractured-memories', '2025-01-01', 't', 'd', 'fractured-memories#ruling:2025-01-01:1')",
        )
        .run(id);

    insert(1001);
    expect(() => insert(1002)).toThrow();
    db.close();
  });
});
