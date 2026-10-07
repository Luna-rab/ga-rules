import type { Database } from "bun:sqlite";
import { and, asc, count, eq, gte, inArray, lte, ne, type SQL, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { z } from "zod";
import {
  card,
  cardReference,
  cardRuling,
  cardTerm,
  clauseCard,
  rulePage,
  ruleClause,
  ruleSection,
  rulingCard,
  term,
  termDefinition,
} from "../../shared/db/schema";
import type { CardQuery } from "../lookup/card-query";
import type { CardDetail, CardSummary } from "../render/cards";

export const SEARCH_LIMIT = 20;

const StringArray = z.array(z.string());
const Cost = z.object({
  type: z.string().nullish(),
  value: z.union([z.string(), z.number()]).nullish(),
});
const Legality = z.record(z.string(), z.object({ limit: z.number().nullish() })).nullable();

type CardRow = typeof card.$inferSelect;

function toSummary(r: CardRow): CardSummary {
  const cost = Cost.parse(JSON.parse(r.cost));
  return {
    slug: r.slug,
    name: r.name,
    types: StringArray.parse(JSON.parse(r.types)),
    subtypes: StringArray.parse(JSON.parse(r.subtypes)),
    classes: StringArray.parse(JSON.parse(r.classes)),
    elements: StringArray.parse(JSON.parse(r.elements)),
    cost: { type: cost.type ?? null, value: cost.value == null ? null : String(cost.value) },
    level: r.level,
    power: r.power,
    life: r.life,
    durability: r.durability,
    speed: r.speed,
    effectRaw: r.effectRaw,
  };
}

// 指定した順に並べて返す。slug が索引に無ければ飛ばす。
export function readCardSummaries(db: Database, slugs: string[]): CardSummary[] {
  if (slugs.length === 0) return [];
  const rows = drizzle(db)
    .select()
    .from(card)
    .where(inArray(card.slug, slugs))
    .all()
    .map(toSummary);
  const bySlug = new Map(rows.map((c) => [c.slug, c]));
  return slugs.flatMap((s) => bySlug.get(s) ?? []);
}

const COLUMN_OF = {
  type: card.types,
  subtype: card.subtypes,
  class: card.classes,
  element: card.elements,
} as const;
const COST_VALUE = sql`json_extract(${card.cost}, '$.value')`;
// 数字のコストだけが範囲に入る。X や null は外れる。
const costAtLeast = (n: number) =>
  sql`(${COST_VALUE} GLOB '[0-9]*' AND CAST(${COST_VALUE} AS REAL) >= ${n})`;
const costAtMost = (n: number) =>
  sql`(${COST_VALUE} GLOB '[0-9]*' AND CAST(${COST_VALUE} AS REAL) <= ${n})`;
const RANGE_COLUMN = {
  level: card.level,
  power: card.power,
  life: card.life,
  durability: card.durability,
} as const;

// legality の JSON パスは値をプレースホルダで渡す。
const formatLimit = (format: string) => sql`json_extract(${card.legality}, ${`$.${format}.limit`})`;

function conditions(q: CardQuery): SQL[] {
  const where: SQL[] = [];
  for (const a of q.attributes) {
    where.push(sql`EXISTS (SELECT 1 FROM json_each(${COLUMN_OF[a.key]}) WHERE value = ${a.value})`);
  }
  if (q.costType !== null) where.push(sql`json_extract(${card.cost}, '$.type') = ${q.costType}`);
  if (q.speed !== null) where.push(eq(card.speed, q.speed));
  if (q.legalIn !== null) where.push(sql`COALESCE(${formatLimit(q.legalIn)}, 1) <> 0`);
  if (q.bannedIn !== null) where.push(sql`${formatLimit(q.bannedIn)} = 0`);
  for (const r of q.ranges) {
    if (r.min !== null) {
      where.push(r.field === "cost" ? costAtLeast(r.min) : gte(RANGE_COLUMN[r.field], r.min));
    }
    if (r.max !== null) {
      where.push(r.field === "cost" ? costAtMost(r.max) : lte(RANGE_COLUMN[r.field], r.max));
    }
  }
  return where;
}

export type CardHit = { card: CardSummary; snippet: string | null };

// 抜粋は効果テキストの列（card_fts の 2 列目）から取る。名前の列に当たっただけのカードの行は、
// 効果の冒頭を出す（抜粋は null）。
const EFFECT_COLUMN = 1;
const HIGHLIGHT = "**";

// 条件をすべて満たすカードの総件数と、先頭 SEARCH_LIMIT 件。
// 全文検索があれば関連度順、無ければ名前順。
export function searchCardRows(db: Database, q: CardQuery): { total: number; hits: CardHit[] } {
  const d = drizzle(db);
  const where = conditions(q);

  if (q.match === null) {
    const total = d
      .select({ n: count() })
      .from(card)
      .where(and(...where))
      .get();
    const rows = d
      .select()
      .from(card)
      .where(and(...where))
      .orderBy(asc(card.name), asc(card.slug))
      .limit(SEARCH_LIMIT)
      .all();
    return {
      total: total?.n ?? 0,
      hits: rows.map((r) => ({ card: toSummary(r), snippet: null })),
    };
  }

  const matched = sql`card.rowid IN (SELECT rowid FROM card_fts WHERE card_fts MATCH ${q.match})`;
  const total = d
    .select({ n: count() })
    .from(card)
    .where(and(matched, ...where))
    .get();

  const ranked = d
    .all(
      sql`SELECT ${card.slug} AS slug,
            snippet(card_fts, ${EFFECT_COLUMN}, ${HIGHLIGHT}, ${HIGHLIGHT}, '…', 12) AS snippet
          FROM card_fts JOIN ${card} ON card.rowid = card_fts.rowid
          WHERE card_fts MATCH ${q.match} AND ${and(...where) ?? sql`1`}
          ORDER BY bm25(card_fts), ${card.name}, ${card.slug}
          LIMIT ${SEARCH_LIMIT}`,
    )
    .map((r) => z.object({ slug: z.string(), snippet: z.string().nullable() }).parse(r));
  const bySlug = new Map(
    readCardSummaries(
      db,
      ranked.map((r) => r.slug),
    ).map((c) => [c.slug, c]),
  );
  return {
    total: total?.n ?? 0,
    hits: ranked.flatMap((r) => {
      const found = bySlug.get(r.slug);
      const highlighted = r.snippet?.includes(HIGHLIGHT) ? r.snippet : null;
      return found ? [{ card: found, snippet: highlighted }] : [];
    }),
  };
}

const toRuling = (r: typeof cardRuling.$inferSelect) => ({
  citeId: r.citeId,
  dateAdded: r.dateAdded,
  title: r.title,
  description: r.description,
});

// 保存した列・裁定全件・用語・参照先・カード名が出る条文と他カードの裁定を読む。
export function readCardDetail(db: Database, slug: string): CardDetail | null {
  const d = drizzle(db);
  const row = d.select().from(card).where(eq(card.slug, slug)).get();
  if (!row) return null;
  const legality = row.legality === null ? null : Legality.parse(JSON.parse(row.legality));

  const rulings = d
    .select()
    .from(cardRuling)
    .where(eq(cardRuling.cardSlug, slug))
    .orderBy(asc(cardRuling.rulingId))
    .all()
    .map(toRuling);

  const termRows = d
    .select({
      name: term.name,
      pageId: termDefinition.pageId,
      sectionId: termDefinition.sectionId,
    })
    .from(cardTerm)
    .innerJoin(term, eq(term.termId, cardTerm.termId))
    .leftJoin(termDefinition, eq(termDefinition.termId, term.termId))
    .where(eq(cardTerm.cardSlug, slug))
    .orderBy(asc(term.name), asc(termDefinition.pageId), asc(termDefinition.sectionId))
    .all();
  const terms: CardDetail["terms"] = [];
  for (const t of termRows) {
    const last = terms.at(-1);
    const entry = last?.name === t.name ? last : { name: t.name, definitionIds: [] };
    if (entry !== last) terms.push(entry);
    const definitionId = t.sectionId ?? t.pageId;
    if (definitionId !== null) entry.definitionIds.push(definitionId);
  }

  const references = d
    .select({ slug: card.slug, name: card.name, kind: cardReference.kind })
    .from(cardReference)
    .innerJoin(card, eq(card.slug, cardReference.toSlug))
    .where(eq(cardReference.fromSlug, slug))
    .orderBy(asc(card.name), asc(card.slug), asc(cardReference.kind))
    .all();

  const clauses = d
    .select({ clauseId: ruleClause.clauseId, text: ruleClause.text })
    .from(clauseCard)
    .innerJoin(ruleClause, eq(ruleClause.clauseId, clauseCard.clauseId))
    .innerJoin(ruleSection, eq(ruleSection.sectionId, ruleClause.sectionId))
    .innerJoin(rulePage, eq(rulePage.pageId, ruleSection.pageId))
    .where(eq(clauseCard.cardSlug, slug))
    .orderBy(asc(rulePage.position), asc(ruleSection.position), asc(ruleClause.position))
    .all();

  const otherRulings = d
    .select({ ruling: cardRuling })
    .from(rulingCard)
    .innerJoin(cardRuling, eq(cardRuling.rulingId, rulingCard.rulingId))
    .where(and(eq(rulingCard.cardSlug, slug), ne(cardRuling.cardSlug, slug)))
    .orderBy(asc(cardRuling.cardSlug), asc(cardRuling.rulingId))
    .all()
    .map((r) => toRuling(r.ruling));

  return {
    ...toSummary(row),
    legality:
      legality &&
      Object.fromEntries(Object.entries(legality).map(([f, v]) => [f, v.limit ?? null])),
    rulings,
    terms,
    references,
    clauses,
    otherRulings,
  };
}
