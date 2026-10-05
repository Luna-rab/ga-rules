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

const DAMAGE_PAGE = "rules/game-mechanics/game-mechanics-damage.md";
const DAMAGE_HEAD = "# Game Mechanics - Damage\n\n#### General Rules:\n\n1. Damage is dealt.\n";

function putValidData(): void {
  put("source.json", "{}\n");
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
    "# Types of Effects - Continuous Effects\n\n#### General Rules\n\n1. Objects can [gain](../../../glossary/game-terms.md#have-gain-get-become-are) abilities.\n2. Effects change [characteristics](/broken/pages/d5fQPRV40fjs6PztDRCI).\n",
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
    expect((error as DataError).message).toContain("no-such-section");
    expect(existsSync(outPath)).toBe(false);
  });
});
