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

const card: Card = {
  slug: "fractured-memories",
  name: "Fractured Memories",
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
  references: null,
  legality: null,
};

describe("buildIndex", () => {
  test("リンク先の節が無いリンクを含むルールがあると DataError で失敗し、outPath は作られない", async () => {
    put("source.json", "{}\n");
    put(
      "rules/game-mechanics/game-mechanics-damage.md",
      "# Game Mechanics - Damage\n\n#### General Rules:\n\n1. See [nowhere](game-mechanics-damage.md#no-such-section).\n",
    );
    put(`cards/${card.slug}.json`, `${JSON.stringify(card, null, 2)}\n`);

    const p = buildIndex({ dataDir, outPath });
    expect(p).toBeInstanceOf(Promise);
    const error = await p.then(
      () => "resolved",
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(DataError);
    expect(existsSync(outPath)).toBe(false);
  });
});
