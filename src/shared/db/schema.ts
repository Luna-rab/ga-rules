import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// テーブルの意味と列の選び方は DESIGN.md の「データベース」を参照。
// rule_clause・card・card_ruling は FTS5 の外部コンテンツ（fts.ts）が rowid で引くので、WITHOUT ROWID にしない。

export const rulePage = sqliteTable("rule_page", {
  pageId: text("page_id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
});

export const ruleSection = sqliteTable("rule_section", {
  sectionId: text("section_id").primaryKey(),
  pageId: text("page_id")
    .notNull()
    .references(() => rulePage.pageId),
  heading: text("heading").notNull(),
});

export const ruleClause = sqliteTable("rule_clause", {
  clauseId: text("clause_id").primaryKey(),
  sectionId: text("section_id")
    .notNull()
    .references(() => ruleSection.sectionId),
  number: text("number").notNull(),
  text: text("text").notNull(),
});

export const clauseLink = sqliteTable("clause_link", {
  clauseId: text("clause_id")
    .notNull()
    .references(() => ruleClause.clauseId),
  pageId: text("page_id")
    .notNull()
    .references(() => rulePage.pageId),
  // ページ全体へのリンクなら NULL
  sectionId: text("section_id").references(() => ruleSection.sectionId),
});

export const term = sqliteTable("term", {
  termId: integer("term_id").primaryKey(),
  name: text("name").notNull(),
});

export const termAlias = sqliteTable(
  "term_alias",
  {
    termId: integer("term_id")
      .notNull()
      .references(() => term.termId),
    alias: text("alias").notNull(),
  },
  (t) => [primaryKey({ columns: [t.termId, t.alias] })],
);

export const termDefinition = sqliteTable("term_definition", {
  termId: integer("term_id")
    .notNull()
    .references(() => term.termId),
  pageId: text("page_id")
    .notNull()
    .references(() => rulePage.pageId),
  // ページ全体の定義なら NULL
  sectionId: text("section_id").references(() => ruleSection.sectionId),
});

// 配列の列・cost・legality は JSON の文字列
export const card = sqliteTable("card", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  types: text("types").notNull(),
  subtypes: text("subtypes").notNull(),
  classes: text("classes").notNull(),
  elements: text("elements").notNull(),
  cost: text("cost").notNull(),
  level: integer("level"),
  power: integer("power"),
  life: integer("life"),
  durability: integer("durability"),
  speed: integer("speed", { mode: "boolean" }),
  effectRaw: text("effect_raw"),
  legality: text("legality"),
});

export const cardRuling = sqliteTable("card_ruling", {
  rulingId: integer("ruling_id").primaryKey(),
  cardSlug: text("card_slug")
    .notNull()
    .references(() => card.slug),
  dateAdded: text("date_added").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
});

export const cardReference = sqliteTable(
  "card_reference",
  {
    fromSlug: text("from_slug")
      .notNull()
      .references(() => card.slug),
    toSlug: text("to_slug")
      .notNull()
      .references(() => card.slug),
    kind: text("kind").notNull(),
  },
  (t) => [primaryKey({ columns: [t.fromSlug, t.toSlug, t.kind] })],
);

export const clauseTerm = sqliteTable(
  "clause_term",
  {
    clauseId: text("clause_id")
      .notNull()
      .references(() => ruleClause.clauseId),
    termId: integer("term_id")
      .notNull()
      .references(() => term.termId),
  },
  (t) => [primaryKey({ columns: [t.clauseId, t.termId] })],
);

export const cardTerm = sqliteTable(
  "card_term",
  {
    cardSlug: text("card_slug")
      .notNull()
      .references(() => card.slug),
    termId: integer("term_id")
      .notNull()
      .references(() => term.termId),
  },
  (t) => [primaryKey({ columns: [t.cardSlug, t.termId] })],
);

export const rulingTerm = sqliteTable(
  "ruling_term",
  {
    rulingId: integer("ruling_id")
      .notNull()
      .references(() => cardRuling.rulingId),
    termId: integer("term_id")
      .notNull()
      .references(() => term.termId),
  },
  (t) => [primaryKey({ columns: [t.rulingId, t.termId] })],
);

export const clauseCard = sqliteTable(
  "clause_card",
  {
    clauseId: text("clause_id")
      .notNull()
      .references(() => ruleClause.clauseId),
    cardSlug: text("card_slug")
      .notNull()
      .references(() => card.slug),
  },
  (t) => [primaryKey({ columns: [t.clauseId, t.cardSlug] })],
);

export const rulingCard = sqliteTable(
  "ruling_card",
  {
    rulingId: integer("ruling_id")
      .notNull()
      .references(() => cardRuling.rulingId),
    cardSlug: text("card_slug")
      .notNull()
      .references(() => card.slug),
  },
  (t) => [primaryKey({ columns: [t.rulingId, t.cardSlug] })],
);
