// data/rules からの相対パス（例 "game-mechanics/game-mechanics-damage.md"）と中身
export type RawPage = { path: string; markdown: string };

export type LinkTarget = { pageId: string; sectionId: string | null }; // null はページ全体

export type Clause = {
  clauseId: string; // "game-mechanics-damage#General Rules:10.a.i"
  sectionId: string;
  number: string; // "10.a.i"。節の頭の番号の無い段落は "0"
  text: string; // hint 展開・画像除去・リンク書き換え済み
  links: LinkTarget[];
};
// heading は `####`、minor は `###` と行頭の太字、lead は最初の見出しより前の本文
export type SectionKind = "heading" | "minor" | "lead";
export type Section = {
  sectionId: string;
  pageId: string;
  heading: string;
  kind: SectionKind;
  clauses: Clause[];
};
export type Page = { pageId: string; title: string; sections: Section[] };
export type TocEntry = { pageId: string; parentPageId: string | null; position: number };

// data/cards/<slug>.json と同じ形（列名もそのまま）
export type CardReference = { kind: string; name: string; slug: string; direction: string };
export type RawRuling = { title: string; date_added: string; description: string };
// 両面カードの裏面も同じ列を持つ
export type CardFace = {
  slug: string;
  name: string;
  types: string[];
  subtypes: string[];
  classes: string[];
  elements: string[];
  cost: { type: string; value: string | null };
  level: number | null;
  power: number | null;
  life: number | null;
  durability: number | null;
  speed: boolean | null;
  effect_raw: string | null;
};
export type Card = CardFace & {
  rule: RawRuling[] | null;
  references: CardReference[] | null;
  legality: Record<string, { limit: number }> | null;
  back: CardFace | null; // 片面のカードは null
};

export type Ruling = {
  rulingId: number;
  citeId: string;
  cardSlug: string;
  dateAdded: string;
  title: string;
  description: string;
};

export type TermDefinition = { pageId: string; sectionId: string | null };
export type Term = {
  termId: number;
  name: string;
  aliases: string[];
  definitions: TermDefinition[];
};
