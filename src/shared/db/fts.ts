// FTS5 の仮想テーブルは drizzle のスキーマで書けないので SQL で持つ。
// 外部コンテンツ（content=）なので元のテーブルを書き換えても索引は追従しない。書き込みの後に FTS_REBUILD_SQL を流す。
const FTS_TABLES = [
  { name: "rule_clause_fts", content: "rule_clause", columns: ["text"] },
  { name: "card_fts", content: "card", columns: ["name", "effect_raw"] },
  { name: "card_ruling_fts", content: "card_ruling", columns: ["title", "description"] },
];

export const FTS_TABLES_SQL: string[] = FTS_TABLES.map(
  (t) =>
    `CREATE VIRTUAL TABLE ${t.name} USING fts5 (${t.columns.join(", ")}, content = '${t.content}', tokenize = 'porter unicode61')`,
);

export const FTS_REBUILD_SQL: string[] = FTS_TABLES.map(
  (t) => `INSERT INTO ${t.name} (${t.name}) VALUES ('rebuild')`,
);
