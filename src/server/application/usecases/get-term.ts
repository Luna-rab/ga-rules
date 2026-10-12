import {
  findTerms,
  GLOSSARY_PAGE_IDS,
  type GlossaryPage,
  toGlossaryPage,
} from "../../domain/glossary";
import type { SectionNode } from "../../domain/model";
import type { ToolContext } from "../context";

// 定義 1 か所分。用語集のページ全体が定義なら用語名の一覧、それ以外は定義の節
export type TermDefinitionBlock =
  | { kind: "glossary"; glossary: GlossaryPage }
  | { kind: "sections"; title: string; pageId: string; sections: SectionNode[] };

export type GetTermResult =
  | { kind: "empty" }
  | { kind: "not-found" }
  | { kind: "ambiguous"; names: string[] }
  | { kind: "found"; name: string; definitions: TermDefinitionBlock[] };

export function getTerm(ctx: ToolContext, term: string): GetTermResult {
  if (term.trim() === "") return { kind: "empty" };
  const matches = findTerms(ctx.catalog.terms, term, ctx.termKeys);
  const found = matches[0];
  if (!found) return { kind: "not-found" };
  if (matches.length > 1) return { kind: "ambiguous", names: matches.map((t) => t.name) };

  const definitions: TermDefinitionBlock[] = [];
  for (const def of found.definitions) {
    const page = ctx.rules.readPage(def.pageId);
    if (!page) continue;
    if (def.sectionId === null && GLOSSARY_PAGE_IDS.includes(def.pageId)) {
      definitions.push({
        kind: "glossary",
        glossary: toGlossaryPage(ctx.catalog.terms, page.title, page.pageId, page.sections),
      });
      continue;
    }
    const sections =
      def.sectionId === null
        ? page.sections
        : page.sections.filter((s) => s.sectionId === def.sectionId);
    definitions.push({ kind: "sections", title: page.title, pageId: page.pageId, sections });
  }
  return { kind: "found", name: found.name, definitions };
}
