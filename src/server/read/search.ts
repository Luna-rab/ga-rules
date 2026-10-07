import type { Database } from "bun:sqlite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { z } from "zod";
import type { ClauseHit, RulingHit } from "../render/search-rules";

const ClauseRow = z.object({ clauseId: z.string(), pageTitle: z.string(), text: z.string() });
const RulingRow = z.object({
  citeId: z.string(),
  dateAdded: z.string(),
  title: z.string(),
  description: z.string(),
});
const FullRow = z.object({ d: z.string() });
const CardRow = z.object({ name: z.string() });
const CountRow = z.object({ n: z.number() });

// ERRATA は書き換えの差分で、カードの文面と並べないと読めないので検索から外す（ERRATA, DTR なども）
const NOT_ERRATA = sql`r.title NOT LIKE 'ERRATA%'`;
// 同じ文面をまとめる前に多めに取る
const RULING_CANDIDATES = 100;
// 当たった語の付近だけを行に載せる（FTS5 の snippet が切り出す語数）
const SNIPPET_TOKENS = 64;

export function searchClauses(db: Database, match: string, limit: number): ClauseHit[] {
  return drizzle(db)
    .all(
      sql`SELECT c.clause_id AS clauseId, p.title AS pageTitle,
                 snippet(rule_clause_fts, 0, '', '', '...', ${SNIPPET_TOKENS}) AS text
          FROM rule_clause_fts f
          JOIN rule_clause c ON c.rowid = f.rowid
          JOIN rule_section s ON s.section_id = c.section_id
          JOIN rule_page p ON p.page_id = s.page_id
          WHERE rule_clause_fts MATCH ${match}
          ORDER BY bm25(rule_clause_fts), c.clause_id
          LIMIT ${limit}`,
    )
    .map((r) => ClauseRow.parse(r));
}

// 同じ文面の裁定は、関連度が最も高い 1 件にまとめ、付いているカードの枚数と 3 枚までの名前を添える
export function searchRulings(db: Database, match: string, limit: number): RulingHit[] {
  const d = drizzle(db);
  const rows = d
    .all(
      sql`SELECT r.cite_id AS citeId, r.date_added AS dateAdded, r.title AS title, snippet(card_ruling_fts, 1, '', '', '...', ${SNIPPET_TOKENS}) AS description
          FROM card_ruling_fts f JOIN card_ruling r ON r.rowid = f.rowid
          WHERE card_ruling_fts MATCH ${match} AND ${NOT_ERRATA}
          ORDER BY bm25(card_ruling_fts), r.cite_id
          LIMIT ${RULING_CANDIDATES}`,
    )
    .map((r) => RulingRow.parse(r));

  const seen = new Set<string>();
  const hits: RulingHit[] = [];
  for (const ruling of rows) {
    const full = FullRow.parse(
      d.all(sql`SELECT description AS d FROM card_ruling WHERE cite_id = ${ruling.citeId}`)[0],
    ).d;
    if (seen.has(full)) continue;
    seen.add(full);
    const count = CountRow.parse(
      d.all(
        sql`SELECT count(DISTINCT r.card_slug) AS n FROM card_ruling r
            WHERE r.description = ${full} AND ${NOT_ERRATA}`,
      )[0],
    );
    const names = d
      .all(
        sql`SELECT DISTINCT c.name AS name FROM card_ruling r JOIN card c ON c.slug = r.card_slug
            WHERE r.description = ${full} AND ${NOT_ERRATA}
            ORDER BY c.name LIMIT 3`,
      )
      .map((r) => CardRow.parse(r).name);
    hits.push({ ruling, cardCount: count.n, cardNames: names });
    if (hits.length === limit) break;
  }
  return hits;
}
