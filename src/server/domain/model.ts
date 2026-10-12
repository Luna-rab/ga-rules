// サーバーが索引から読んで扱うデータの形。索引の列ではなく、ツールが使う形にしてある。

// キーは page_id と section_id、値は公式サイトの URL
export type RuleUrls = ReadonlyMap<string, string>;

export type ClauseNode = { clauseId: string; text: string };
export type SectionNode = {
  sectionId: string;
  heading: string;
  url: string;
  clauses: ClauseNode[];
};
export type PageNode = { pageId: string; title: string; sections: SectionNode[] };

export type RulingNode = { citeId: string; dateAdded: string; title: string; description: string };

export type CardCost = { type: string | null; value: string | null };

export type CardSummary = {
  slug: string;
  name: string;
  types: string[];
  subtypes: string[];
  classes: string[];
  elements: string[];
  cost: CardCost;
  level: number | null;
  power: number | null;
  life: number | null;
  durability: number | null;
  speed: boolean | null;
  effectRaw: string | null;
  frontSlug: string | null;
};

export type CardDetail = CardSummary & {
  // formats 名 → limit（0 なら禁止）
  legality: Record<string, number | null> | null;
  backFace: CardSummary | null;
  frontFace: { slug: string; name: string } | null;
  // 裏面でも表のカードの裁定
  rulings: RulingNode[];
  // definitionIds は用語の定義の引用 ID（節 ID、ページ全体ならページ ID）
  terms: { name: string; definitionIds: string[] }[];
  references: { slug: string; name: string; kind: string }[];
  clauses: (ClauseNode & { url: string })[];
  otherRulings: RulingNode[];
};

// snippet は当たった語を ** で囲んだ効果テキストの抜粋。名前にだけ当たったときは null
export type CardHit = { card: CardSummary; snippet: string | null };

export type ClauseHit = { clauseId: string; pageTitle: string; url: string; text: string };
export type RulingHit = { ruling: RulingNode; cardCount: number; cardNames: string[] };

export type TocEntry = {
  pageId: string;
  title: string;
  parentPageId: string | null;
  depth: number;
};
export type TermEntry = {
  name: string;
  aliases: string[];
  // sectionId が null なら、ページ全体が定義
  definitions: { pageId: string; sectionId: string | null }[];
};
export type CardEntry = { slug: string; name: string };
export type Attributes = {
  types: string[];
  subtypes: string[];
  classes: string[];
  elements: string[];
};

// 起動時に 1 回だけ読む、変わらないデータ。
export type Catalog = {
  // rule_page.position の順（親が子より先）
  toc: TocEntry[];
  // OVERVIEW_PAGE_IDS の順
  overview: PageNode[];
  terms: TermEntry[];
  cards: CardEntry[];
  attributes: Attributes;
  ruleUrls: RuleUrls;
};
