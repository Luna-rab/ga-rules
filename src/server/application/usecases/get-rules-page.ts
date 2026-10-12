import { pageIdOfCiteId } from "../../../shared/domain/cite";
import { GLOSSARY_PAGE_IDS, type GlossaryPage, toGlossaryPage } from "../../domain/glossary";
import type { PageNode } from "../../domain/model";
import type { ToolContext } from "../context";

export type GetRulesPageResult =
  | { kind: "unknown-page"; pageId: string }
  // 目次にはあるのに索引にページが無い。索引の作り方の誤り
  | { kind: "missing-in-index"; pageId: string }
  | { kind: "glossary"; glossary: GlossaryPage }
  | { kind: "page"; page: PageNode };

// 引用 ID を渡されたら、# より前をページ ID として読む
export function getRulesPage(ctx: ToolContext, pageIdOrCiteId: string): GetRulesPageResult {
  const pageId = pageIdOfCiteId(pageIdOrCiteId.trim());
  const entry = ctx.catalog.toc.find((e) => e.pageId === pageId);
  if (!entry) return { kind: "unknown-page", pageId };
  if (GLOSSARY_PAGE_IDS.includes(pageId)) {
    const sections = ctx.rules.readPage(pageId)?.sections ?? [];
    return {
      kind: "glossary",
      glossary: toGlossaryPage(ctx.catalog.terms, entry.title, pageId, sections),
    };
  }
  const page = ctx.rules.readPage(pageId);
  if (!page) return { kind: "missing-in-index", pageId };
  return { kind: "page", page };
}
