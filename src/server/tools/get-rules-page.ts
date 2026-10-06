import { z } from "zod";
import { pageIdOfCiteId } from "../../shared/cite";
import { generalSections, GLOSSARY_PAGE_IDS, glossaryTermNames } from "../lookup/glossary";
import { readPage } from "../read/pages";
import { renderSections } from "../render/clauses";
import { renderGlossary } from "../render/glossary";
import type { ToolDefinition } from "./types";

export const getRulesPage: ToolDefinition<{ page_id: z.ZodString }> = {
  name: "get_rules_page",
  description:
    "Returns a whole Grand Archive rules page, every clause prefixed with its [clause_id]. Accepts a page_id, or a clause ID from search_rules (the part after # is ignored). The glossary pages return a list of term names; use get_term for those.",
  inputSchema: { page_id: z.string() },
  handler: (ctx, { page_id }) => {
    const pageId = pageIdOfCiteId(page_id.trim());
    const entry = ctx.catalog.toc.find((e) => e.pageId === pageId);
    if (!entry) {
      return {
        text: `No rules page with page_id "${pageId}". Find the page_id in the table of contents from get_game_overview, or locate the clause with search_rules.`,
        isError: true,
        count: 0,
      };
    }
    if (GLOSSARY_PAGE_IDS.includes(pageId)) {
      const names = glossaryTermNames(ctx.catalog.terms, pageId);
      const general = generalSections(
        ctx.catalog.terms,
        pageId,
        readPage(ctx.db, pageId)?.sections ?? [],
      );
      return { text: renderGlossary(entry.title, pageId, names, general), count: 1 };
    }
    const page = readPage(ctx.db, pageId);
    if (!page)
      return { text: `Rules page "${pageId}" is missing from the index.`, isError: true, count: 0 };
    return {
      text: `# ${page.title} (${page.pageId})\n\n${renderSections(page.sections)}`,
      count: 1,
    };
  },
};
