import type { Database } from "bun:sqlite";
import { z } from "zod";
import type { CardQuery } from "../lookup/card-query";
import type { CardDetail, CardSummary } from "../render/cards";

export const SEARCH_LIMIT = 20;

const StringArray = z.array(z.string());
const Cost = z.object({
  type: z.string().nullish(),
  value: z.union([z.string(), z.number()]).nullish(),
});
const Legality = z.record(z.string(), z.object({ limit: z.number().nullish() })).nullable();

const CardRow = z.object({
  slug: z.string(),
  name: z.string(),
  types: z.string(),
  subtypes: z.string(),
  classes: z.string(),
  elements: z.string(),
  cost: z.string(),
  level: z.number().nullable(),
  power: z.number().nullable(),
  life: z.number().nullable(),
  durability: z.number().nullable(),
  speed: z.number().nullable(),
  effect_raw: z.string().nullable(),
  legality: z.string().nullable(),
});
type CardRow = z.infer<typeof CardRow>;

const CARD_COLUMNS = `card.slug, card.name, card.types, card.subtypes, card.classes, card.elements,
  card.cost, card.level, card.power, card.life, card.durability, card.speed, card.effect_raw,
  card.legality`;

function toSummary(r: CardRow): CardSummary {
  const cost = Cost.parse(JSON.parse(r.cost));
  return {
    slug: r.slug,
    name: r.name,
    types: StringArray.parse(JSON.parse(r.types)),
    subtypes: StringArray.parse(JSON.parse(r.subtypes)),
    classes: StringArray.parse(JSON.parse(r.classes)),
    elements: StringArray.parse(JSON.parse(r.elements)),
    cost: { type: cost.type ?? null, value: cost.value === undefined ? null : String(cost.value) },
    level: r.level,
    power: r.power,
    life: r.life,
    durability: r.durability,
    speed: r.speed === null ? null : r.speed !== 0,
    effectRaw: r.effect_raw,
  };
}

// 指定した順に並べて返す。slug が索引に無ければ飛ばす。
export function readCardSummaries(db: Database, slugs: string[]): CardSummary[] {
  if (slugs.length === 0) return [];
  const marks = slugs.map(() => "?").join(", ");
  const rows = db
    .query(`SELECT ${CARD_COLUMNS} FROM card WHERE card.slug IN (${marks})`)
    .all(...slugs)
    .map((r) => toSummary(CardRow.parse(r)));
  const bySlug = new Map(rows.map((c) => [c.slug, c]));
  return slugs.flatMap((s) => bySlug.get(s) ?? []);
}

const inJson = (column: string) =>
  `EXISTS (SELECT 1 FROM json_each(card.${column}) WHERE value = ?)`;
const COLUMN_OF = {
  type: "types",
  subtype: "subtypes",
  class: "classes",
  element: "elements",
} as const;
const VALUE = "json_extract(card.cost, '$.value')";
const RANGE_SQL = {
  cost: `${VALUE} GLOB '[0-9]*' AND CAST(${VALUE} AS REAL)`,
  level: "card.level",
  power: "card.power",
  life: "card.life",
  durability: "card.durability",
} as const;

function conditions(q: CardQuery): { where: string[]; params: (string | number)[] } {
  const where: string[] = [];
  const params: (string | number)[] = [];
  for (const a of q.attributes) {
    where.push(inJson(COLUMN_OF[a.key]));
    params.push(a.value);
  }
  if (q.costType !== null) {
    where.push("json_extract(card.cost, '$.type') = ?");
    params.push(q.costType);
  }
  if (q.speed !== null) {
    where.push("card.speed = ?");
    params.push(q.speed ? 1 : 0);
  }
  // 形式名は lookup/ が STANDARD・PANTHEON・DRAFT に絞っているので、パスに埋めてよい
  if (q.legalIn !== null) {
    where.push(`COALESCE(json_extract(card.legality, '$.${q.legalIn}.limit'), 1) <> 0`);
  }
  if (q.bannedIn !== null) {
    where.push(`json_extract(card.legality, '$.${q.bannedIn}.limit') = 0`);
  }
  for (const r of q.ranges) {
    if (r.min !== null) {
      where.push(`${RANGE_SQL[r.field]} >= ?`);
      params.push(r.min);
    }
    if (r.max !== null) {
      where.push(`${RANGE_SQL[r.field]} <= ?`);
      params.push(r.max);
    }
  }
  return { where, params };
}

export type CardHit = { card: CardSummary; snippet: string | null };

// 条件をすべて満たすカードの総件数と、先頭 SEARCH_LIMIT 件。
// 全文検索があれば関連度順、無ければ名前順。
export function searchCardRows(db: Database, q: CardQuery): { total: number; hits: CardHit[] } {
  const { where, params } = conditions(q);
  const from = q.match === null ? "card" : "card_fts JOIN card ON card.rowid = card_fts.rowid";
  const clauses = q.match === null ? where : ["card_fts MATCH ?", ...where];
  const bound = q.match === null ? params : [q.match, ...params];
  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const total = z
    .object({ n: z.number() })
    .parse(db.query(`SELECT COUNT(*) AS n FROM ${from} ${whereSql}`).get(...bound)).n;

  const snippet = q.match === null ? "NULL" : "snippet(card_fts, -1, '[', ']', '…', 12)";
  const order = q.match === null ? "card.name, card.slug" : "bm25(card_fts), card.name, card.slug";
  const rows = db
    .query(
      `SELECT ${CARD_COLUMNS}, ${snippet} AS snippet FROM ${from} ${whereSql}
       ORDER BY ${order} LIMIT ${SEARCH_LIMIT}`,
    )
    .all(...bound)
    .map((r) => {
      const row = CardRow.extend({ snippet: z.string().nullable() }).parse(r);
      return { card: toSummary(row), snippet: row.snippet };
    });
  return { total, hits: rows };
}

const RulingRow = z.object({
  cite_id: z.string(),
  date_added: z.string(),
  title: z.string(),
  description: z.string(),
});
const toRuling = (r: z.infer<typeof RulingRow>) => ({
  citeId: r.cite_id,
  dateAdded: r.date_added,
  title: r.title,
  description: r.description,
});

// 保存した列・裁定全件・用語・参照先・カード名が出る条文と他カードの裁定を読む。
export function readCardDetail(db: Database, slug: string): CardDetail | null {
  const row = db.query(`SELECT ${CARD_COLUMNS} FROM card WHERE card.slug = ?`).get(slug);
  if (!row) return null;
  const parsed = CardRow.parse(row);
  const legality = parsed.legality === null ? null : Legality.parse(JSON.parse(parsed.legality));

  const rulings = db
    .query(
      `SELECT cite_id, date_added, title, description FROM card_ruling
       WHERE card_slug = ? ORDER BY ruling_id`,
    )
    .all(slug)
    .map((r) => toRuling(RulingRow.parse(r)));

  const termRows = db
    .query(
      `SELECT t.name, COALESCE(d.section_id, d.page_id) AS definition_id
       FROM card_term ct
       JOIN term t ON t.term_id = ct.term_id
       LEFT JOIN term_definition d ON d.term_id = t.term_id
       WHERE ct.card_slug = ?
       ORDER BY t.name, d.page_id, d.section_id`,
    )
    .all(slug)
    .map((r) => z.object({ name: z.string(), definition_id: z.string().nullable() }).parse(r));
  const terms: CardDetail["terms"] = [];
  for (const t of termRows) {
    const last = terms.at(-1);
    const entry = last?.name === t.name ? last : { name: t.name, definitionIds: [] };
    if (entry !== last) terms.push(entry);
    if (t.definition_id !== null) entry.definitionIds.push(t.definition_id);
  }

  const references = db
    .query(
      `SELECT c.slug, c.name, r.kind FROM card_reference r
       JOIN card c ON c.slug = r.to_slug
       WHERE r.from_slug = ? ORDER BY c.name, c.slug, r.kind`,
    )
    .all(slug)
    .map((r) => z.object({ slug: z.string(), name: z.string(), kind: z.string() }).parse(r));

  const clauses = db
    .query(
      `SELECT c.clause_id, c.text FROM clause_card cc
       JOIN rule_clause c ON c.clause_id = cc.clause_id
       JOIN rule_section s ON s.section_id = c.section_id
       JOIN rule_page p ON p.page_id = s.page_id
       WHERE cc.card_slug = ?
       ORDER BY p.position, s.position, c.position`,
    )
    .all(slug)
    .map((r) => z.object({ clause_id: z.string(), text: z.string() }).parse(r))
    .map((r) => ({ clauseId: r.clause_id, text: r.text }));

  const otherRulings = db
    .query(
      `SELECT r.cite_id, r.date_added, r.title, r.description FROM ruling_card rc
       JOIN card_ruling r ON r.ruling_id = rc.ruling_id
       WHERE rc.card_slug = ? AND r.card_slug <> ?
       ORDER BY r.card_slug, r.ruling_id`,
    )
    .all(slug, slug)
    .map((r) => toRuling(RulingRow.parse(r)));

  return {
    ...toSummary(parsed),
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
