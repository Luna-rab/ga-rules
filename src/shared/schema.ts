import type { Database } from "bun:sqlite";

// テーブルの意味と列の選び方は DESIGN.md の「データベース」を参照。
const DDL = `
CREATE TABLE rule_page (
  page_id TEXT PRIMARY KEY,
  title   TEXT NOT NULL,
  body    TEXT NOT NULL
);

CREATE TABLE term (
  term    TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES rule_page (page_id),
  section TEXT NOT NULL DEFAULT '', -- 節の見出し。ページ全体の定義なら空
  body    TEXT NOT NULL
);

CREATE TABLE card (
  slug         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  types        TEXT NOT NULL, -- JSON 配列
  subtypes     TEXT NOT NULL, -- JSON 配列
  classes      TEXT NOT NULL, -- JSON 配列
  elements     TEXT NOT NULL, -- JSON 配列
  cost_reserve INTEGER,
  cost_memory  INTEGER,
  level        INTEGER,
  power        INTEGER,
  life         INTEGER,
  durability   INTEGER,
  speed        TEXT,
  effect_raw   TEXT,
  effect       TEXT
);

CREATE TABLE card_ruling (
  id          INTEGER PRIMARY KEY,
  card_slug   TEXT NOT NULL REFERENCES card (slug),
  date_added  TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE card_reference (
  from_slug TEXT NOT NULL REFERENCES card (slug),
  to_slug   TEXT NOT NULL REFERENCES card (slug),
  kind      TEXT NOT NULL,
  PRIMARY KEY (from_slug, to_slug, kind)
);

CREATE TABLE page_term (
  page_id TEXT NOT NULL REFERENCES rule_page (page_id),
  term    TEXT NOT NULL REFERENCES term (term),
  PRIMARY KEY (page_id, term)
);

CREATE TABLE page_card (
  page_id   TEXT NOT NULL REFERENCES rule_page (page_id),
  card_slug TEXT NOT NULL REFERENCES card (slug),
  PRIMARY KEY (page_id, card_slug)
);

CREATE TABLE card_term (
  card_slug TEXT NOT NULL REFERENCES card (slug),
  term      TEXT NOT NULL REFERENCES term (term),
  PRIMARY KEY (card_slug, term)
);

CREATE TABLE ruling_term (
  ruling_id INTEGER NOT NULL REFERENCES card_ruling (id),
  term      TEXT NOT NULL REFERENCES term (term),
  PRIMARY KEY (ruling_id, term)
);

CREATE VIRTUAL TABLE rule_page_fts USING fts5 (
  title, body,
  content = 'rule_page', tokenize = 'porter unicode61'
);

CREATE VIRTUAL TABLE card_fts USING fts5 (
  name, effect,
  content = 'card', tokenize = 'porter unicode61'
);
`;

export function createSchema(db: Database): void {
  db.run(DDL);
}
