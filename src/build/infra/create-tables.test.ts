import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { FTS_REBUILD_SQL } from "../../shared/db/fts";
import { createTables } from "./create-tables";

const TABLES = [
  "rule_page",
  "rule_section",
  "rule_clause",
  "clause_link",
  "term",
  "term_alias",
  "term_definition",
  "card",
  "card_ruling",
  "card_reference",
  "clause_term",
  "card_term",
  "ruling_term",
  "clause_card",
  "ruling_card",
];
const FTS_TABLES = ["rule_clause_fts", "card_fts", "card_ruling_fts"];

async function freshDb(): Promise<Database> {
  const db = new Database(":memory:");
  db.run("PRAGMA foreign_keys = ON");
  await createTables(db);
  return db;
}

type ColumnInfo = { name: string; type: string; notnull: number; dflt_value: unknown; pk: number };

// 受入条件が決めていない列（card の types など）は、NOT NULL で既定値の無いものだけ仮の値で埋める。
function insertRow(db: Database, table: string, values: Record<string, string | number>): void {
  const row: Record<string, string | number> = { ...values };
  const columns = db.query<ColumnInfo, []>(`PRAGMA table_info(${table})`).all();
  for (const c of columns) {
    if (c.name in row || c.notnull === 0 || c.dflt_value !== null) continue;
    if (c.pk > 0 && c.type.toUpperCase() === "INTEGER") continue;
    row[c.name] = c.type.toUpperCase().includes("INT") ? 0 : "[]";
  }
  const names = Object.keys(row);
  db.query(
    `INSERT INTO ${table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})`,
  ).run(...names.map((n) => row[n]!));
}

describe("createTables", () => {
  test("空の DB に 15 テーブルと 3 つの FTS テーブルを作る", async () => {
    const db = await freshDb();
    const names = db
      .query<{ name: string }, []>("SELECT name FROM sqlite_master")
      .all()
      .map((r) => r.name);
    for (const t of [...TABLES, ...FTS_TABLES]) expect(names).toContain(t);
  });

  test("FTS テーブルは porter unicode61 で作る", async () => {
    const db = await freshDb();
    for (const t of FTS_TABLES) {
      const row = db
        .query<{ sql: string }, [string]>("SELECT sql FROM sqlite_master WHERE name = ?")
        .get(t);
      expect(row).not.toBeNull();
      expect(row!.sql).toContain("porter unicode61");
    }
  });

  test("存在しない page_id を持つ rule_section は INSERT できない", async () => {
    const db = await freshDb();
    insertRow(db, "rule_page", {
      page_id: "game-mechanics-damage",
      title: "Damage",
      position: 0,
    });
    // 親があれば入る（失敗の原因が page_id だけであることを確かめる）
    insertRow(db, "rule_section", {
      section_id: "game-mechanics-damage#General Rules",
      page_id: "game-mechanics-damage",
      heading: "General Rules",
    });
    expect(() =>
      insertRow(db, "rule_section", {
        section_id: "no-such-page#General Rules",
        page_id: "no-such-page",
        heading: "General Rules",
      }),
    ).toThrow();
  });

  test("card に無い slug を to_slug に持つ card_reference は INSERT できない", async () => {
    const db = await freshDb();
    insertRow(db, "card", { slug: "merlin-amethysts-glow", name: "Merlin, Amethyst's Glow" });
    insertRow(db, "card", { slug: "fractured-memories", name: "Fractured Memories" });
    insertRow(db, "card_reference", {
      from_slug: "merlin-amethysts-glow",
      to_slug: "fractured-memories",
      kind: "INCLUDE",
    });
    expect(() =>
      insertRow(db, "card_reference", {
        from_slug: "merlin-amethysts-glow",
        to_slug: "crystal-mastery",
        kind: "INCLUDE",
      }),
    ).toThrow();
  });

  test("FTS_REBUILD_SQL の後に rule_clause_fts を porter の語幹一致で引ける", async () => {
    const db = await freshDb();
    insertRow(db, "rule_page", {
      page_id: "game-mechanics-damage",
      title: "Damage",
      position: 0,
    });
    insertRow(db, "rule_section", {
      section_id: "game-mechanics-damage#General Rules",
      page_id: "game-mechanics-damage",
      heading: "General Rules",
    });
    insertRow(db, "rule_clause", {
      clause_id: "game-mechanics-damage#General Rules:13",
      section_id: "game-mechanics-damage#General Rules",
      number: "13",
      text: "Champions with Immortality will not die",
    });
    insertRow(db, "rule_clause", {
      clause_id: "game-mechanics-damage#General Rules:14",
      section_id: "game-mechanics-damage#General Rules",
      number: "14",
      text: "Damage is dealt to the target",
    });
    for (const sql of FTS_REBUILD_SQL) db.run(sql);

    const rows = db
      .query(
        `SELECT rule_clause.clause_id AS clause_id, rule_clause_fts.text AS text
         FROM rule_clause_fts JOIN rule_clause ON rule_clause.rowid = rule_clause_fts.rowid
         WHERE rule_clause_fts MATCH 'immortal'`,
      )
      .all();
    expect(rows).toEqual([
      {
        clause_id: "game-mechanics-damage#General Rules:13",
        text: "Champions with Immortality will not die",
      },
    ]);
  });
});
