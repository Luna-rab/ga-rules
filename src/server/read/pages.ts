import type { Database } from "bun:sqlite";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { ruleClause, rulePage, ruleSection } from "../../shared/db/schema";
import type { SectionNode } from "../render/clauses";

export type PageNode = { pageId: string; title: string; sections: SectionNode[] };

// ページを節と条文の順（position）に読む。ページが無ければ null。
export function readPage(db: Database, pageId: string): PageNode | null {
  const d = drizzle(db);
  const page = d.select().from(rulePage).where(eq(rulePage.pageId, pageId)).get();
  if (!page) return null;

  const sections = d
    .select()
    .from(ruleSection)
    .where(eq(ruleSection.pageId, pageId))
    .orderBy(asc(ruleSection.position))
    .all();
  const clauses = d
    .select({
      sectionId: ruleClause.sectionId,
      clauseId: ruleClause.clauseId,
      text: ruleClause.text,
    })
    .from(ruleClause)
    .innerJoin(ruleSection, eq(ruleClause.sectionId, ruleSection.sectionId))
    .where(eq(ruleSection.pageId, pageId))
    .orderBy(asc(ruleSection.position), asc(ruleClause.position))
    .all();

  return {
    pageId,
    title: page.title,
    sections: sections.map((s) => ({
      sectionId: s.sectionId,
      heading: s.heading,
      url: s.url,
      clauses: clauses
        .filter((c) => c.sectionId === s.sectionId)
        .map((c) => ({ clauseId: c.clauseId, text: c.text })),
    })),
  };
}
