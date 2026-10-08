import type { Database } from "bun:sqlite";
import { asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { z } from "zod";
import { OVERVIEW_PAGE_IDS } from "../../shared/overview";
import { card, rulePage, term, termAlias, termDefinition } from "../../shared/db/schema";
import type { RuleUrls } from "../render/rule-links";
import { type PageNode, readPage } from "./pages";

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
  // page_id・section_id → 公式サイトの URL
  ruleUrls: RuleUrls;
};

const StringArray = z.array(z.string());

function distinctSorted(values: Set<string>): string[] {
  return [...values].toSorted();
}

export function loadCatalog(db: Database): Catalog {
  const d = drizzle(db);

  const pages = d.select().from(rulePage).orderBy(asc(rulePage.position)).all();
  const depthOf = new Map<string, number>();
  const toc = pages.map((p) => {
    const depth = p.parentPageId === null ? 0 : (depthOf.get(p.parentPageId) ?? 0) + 1;
    depthOf.set(p.pageId, depth);
    return { pageId: p.pageId, title: p.title, parentPageId: p.parentPageId, depth };
  });

  const overview = OVERVIEW_PAGE_IDS.map((id) => {
    const page = readPage(db, id);
    if (!page) throw new Error(`概要のページが索引に無い: ${id}`);
    return page;
  });

  const aliases = new Map<number, string[]>();
  for (const a of d
    .select()
    .from(termAlias)
    .orderBy(asc(termAlias.termId), asc(termAlias.alias))
    .all()) {
    aliases.set(a.termId, [...(aliases.get(a.termId) ?? []), a.alias]);
  }
  const definitions = new Map<number, TermEntry["definitions"]>();
  for (const def of d
    .select()
    .from(termDefinition)
    .orderBy(asc(termDefinition.termId), asc(termDefinition.pageId), asc(termDefinition.sectionId))
    .all()) {
    definitions.set(def.termId, [
      ...(definitions.get(def.termId) ?? []),
      { pageId: def.pageId, sectionId: def.sectionId },
    ]);
  }
  const terms = d
    .select()
    .from(term)
    .orderBy(asc(term.termId))
    .all()
    .map((t) => ({
      name: t.name,
      aliases: aliases.get(t.termId) ?? [],
      definitions: definitions.get(t.termId) ?? [],
    }));

  const cardRows = d
    .select({
      slug: card.slug,
      name: card.name,
      types: card.types,
      subtypes: card.subtypes,
      classes: card.classes,
      elements: card.elements,
    })
    .from(card)
    .orderBy(asc(card.slug))
    .all();
  const sets = {
    types: new Set<string>(),
    subtypes: new Set<string>(),
    classes: new Set<string>(),
    elements: new Set<string>(),
  };
  for (const c of cardRows) {
    for (const key of ["types", "subtypes", "classes", "elements"] as const) {
      for (const v of StringArray.parse(JSON.parse(c[key]))) sets[key].add(v);
    }
  }

  return {
    toc,
    overview,
    terms,
    cards: cardRows.map((c) => ({ slug: c.slug, name: c.name })),
    ruleUrls: new Map(),
    attributes: {
      types: distinctSorted(sets.types),
      subtypes: distinctSorted(sets.subtypes),
      classes: distinctSorted(sets.classes),
      elements: distinctSorted(sets.elements),
    },
  };
}
