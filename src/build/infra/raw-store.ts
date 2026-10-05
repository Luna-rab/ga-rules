import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { DataError } from "../domain/errors";
import type { Card, RawPage } from "../domain/model";
import { CardSchema } from "./card-schema";

// SUMMARY.md は GitBook の目次で、ルールのページではない。
const NOT_PAGES = new Set(["SUMMARY.md"]);

export async function readRules(dataDir: string): Promise<RawPage[]> {
  const rulesDir = join(dataDir, "rules");
  const paths = (await readdir(rulesDir, { recursive: true }))
    .filter((p) => p.endsWith(".md") && !NOT_PAGES.has(p))
    .toSorted();
  return Promise.all(
    paths.map(async (path) => ({ path, markdown: await Bun.file(join(rulesDir, path)).text() })),
  );
}

export async function readCards(dataDir: string): Promise<Card[]> {
  const cardsDir = join(dataDir, "cards");
  const files = (await readdir(cardsDir)).filter((f) => f.endsWith(".json")).toSorted();
  return Promise.all(
    files.map(async (file) => {
      let json: unknown;
      try {
        json = await Bun.file(join(cardsDir, file)).json();
      } catch (e) {
        throw new DataError(`cards/${file}`, e instanceof Error ? e.message : String(e));
      }
      const result = CardSchema.safeParse(json);
      if (!result.success) throw new DataError(`cards/${file}`, result.error.message);
      return result.data;
    }),
  );
}
