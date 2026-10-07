import { Database } from "bun:sqlite";
import { renameSync, rmSync } from "node:fs";
import { drizzle } from "drizzle-orm/bun-sqlite";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { FTS_REBUILD_SQL } from "../../shared/db/fts";
import * as schema from "../../shared/db/schema";
import type { Card, Page, Ruling, Term, TocEntry } from "../domain/model";
import type { Relations } from "../domain/relate";
import { createTables } from "./create-tables";

export type IndexData = {
  pages: Page[];
  toc: TocEntry[];
  terms: Term[];
  cards: Card[];
  rulings: Ruling[];
  relations: Relations;
};

// 1 つの INSERT に載せる行数。SQLite の変数の上限（32766）を超えないようにする。
const CHUNK = 500;

// outPath の横の一時ファイルに PRAGMA foreign_keys=ON で書き、FTS を rebuild してから outPath へ rename する
export async function writeIndex(outPath: string, data: IndexData): Promise<void> {
  // 名前を固定にして、前の実行が途中で止まって残した一時ファイルも次の実行で消す。
  const tmpPath = `${outPath}.tmp`;
  rmSync(tmpPath, { force: true });
  const sqlite = new Database(tmpPath, { create: true, strict: true });
  try {
    sqlite.run("PRAGMA foreign_keys = ON");
    await createTables(sqlite);
    const db = drizzle({ client: sqlite, schema });
    db.transaction((tx) => {
      const insert = <T extends SQLiteTable>(table: T, rows: T["$inferInsert"][]) => {
        for (let i = 0; i < rows.length; i += CHUNK) {
          tx.insert(table)
            .values(rows.slice(i, i + CHUNK))
            .run();
        }
      };
      insertRows(insert, data);
    });
    for (const sql of FTS_REBUILD_SQL) sqlite.run(sql);
    sqlite.close();
    renameSync(tmpPath, outPath);
  } catch (e) {
    sqlite.close();
    rmSync(tmpPath, { force: true });
    throw e;
  }
}

type Insert = <T extends SQLiteTable>(table: T, rows: T["$inferInsert"][]) => void;

// 外部キーの参照先から順に書く。
function insertRows(
  insert: Insert,
  { pages, toc, terms, cards, rulings, relations }: IndexData,
): void {
  const sections = pages.flatMap((p) => p.sections);
  const clauses = sections.flatMap((s) => s.clauses);
  const titles = new Map(pages.map((p) => [p.pageId, p.title]));

  insert(
    schema.rulePage,
    // 親が子より先に並ぶよう position の順に書く（parent_page_id の外部キーのため）
    toc.map((e) => ({
      pageId: e.pageId,
      title: titles.get(e.pageId) ?? "",
      parentPageId: e.parentPageId,
      position: e.position,
    })),
  );
  insert(
    schema.ruleSection,
    pages.flatMap((p) =>
      p.sections.map((s, position) => ({
        sectionId: s.sectionId,
        pageId: s.pageId,
        heading: s.heading,
        position,
      })),
    ),
  );
  insert(
    schema.ruleClause,
    sections.flatMap((s) =>
      s.clauses.map((c, position) => ({
        clauseId: c.clauseId,
        sectionId: c.sectionId,
        number: c.number,
        text: c.text,
        position,
      })),
    ),
  );
  insert(
    schema.clauseLink,
    clauses.flatMap((c) =>
      c.links.map((l) => ({ clauseId: c.clauseId, pageId: l.pageId, sectionId: l.sectionId })),
    ),
  );

  insert(
    schema.term,
    terms.map((t) => ({ termId: t.termId, name: t.name })),
  );
  insert(
    schema.termAlias,
    terms.flatMap((t) => t.aliases.map((alias) => ({ termId: t.termId, alias }))),
  );
  insert(
    schema.termDefinition,
    terms.flatMap((t) =>
      t.definitions.map((d) => ({ termId: t.termId, pageId: d.pageId, sectionId: d.sectionId })),
    ),
  );

  insert(
    schema.card,
    cards.map((c) => ({
      slug: c.slug,
      name: c.name,
      types: JSON.stringify(c.types),
      subtypes: JSON.stringify(c.subtypes),
      classes: JSON.stringify(c.classes),
      elements: JSON.stringify(c.elements),
      cost: JSON.stringify(c.cost),
      level: c.level,
      power: c.power,
      life: c.life,
      durability: c.durability,
      speed: c.speed,
      effectRaw: c.effect_raw,
      legality: c.legality === null ? null : JSON.stringify(c.legality),
    })),
  );
  insert(
    schema.cardRuling,
    rulings.map((r) => ({
      rulingId: r.rulingId,
      citeId: r.citeId,
      cardSlug: r.cardSlug,
      dateAdded: r.dateAdded,
      title: r.title,
      description: r.description,
    })),
  );

  insert(schema.cardReference, relations.cardReferences);
  insert(schema.clauseTerm, relations.clauseTerms);
  insert(schema.cardTerm, relations.cardTerms);
  insert(schema.rulingTerm, relations.rulingTerms);
  insert(schema.clauseCard, relations.clauseCards);
  insert(schema.rulingCard, relations.rulingCards);
}
