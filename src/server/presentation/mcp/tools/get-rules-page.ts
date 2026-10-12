import { z } from "zod";
import { getRulesPage as run } from "../../../application/usecases/get-rules-page";
import { renderSections } from "../../markdown/clauses";
import { renderGlossary } from "../../markdown/glossary";
import type { ToolDefinition } from "./types";

export const getRulesPage: ToolDefinition<{ page_id: z.ZodString }> = {
  name: "get_rules_page",
  description:
    "Returns a whole Grand Archive rules page, every clause prefixed with its [clause_id]. Accepts a page_id, or a clause ID from search_rules (the part after # is ignored). The glossary pages return a list of term names; use get_term for those.",
  inputSchema: { page_id: z.string() },
  handler: (ctx, { page_id }) => {
    const result = run(ctx, page_id);
    switch (result.kind) {
      case "unknown-page":
        return {
          text: `No rules page with page_id "${result.pageId}". Find the page_id in the table of contents from get_game_overview, or locate the clause with search_rules.`,
          isError: true,
          count: 0,
        };
      case "missing-in-index":
        return {
          text: `Rules page "${result.pageId}" is missing from the index.`,
          isError: true,
          count: 0,
        };
      case "glossary":
        return { text: renderGlossary(result.glossary, ctx.catalog.ruleUrls), count: 1 };
    }
    const { page } = result;
    return {
      text: `# ${page.title} (${page.pageId})\n\n${renderSections(page.sections, ctx.catalog.ruleUrls)}`,
      count: 1,
    };
  },
};
