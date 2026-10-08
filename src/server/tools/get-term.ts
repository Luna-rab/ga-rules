import { z } from "zod";
import {
  findTerms,
  generalSections,
  GLOSSARY_PAGE_IDS,
  glossaryTermNames,
} from "../lookup/glossary";
import { readPage } from "../read/pages";
import { renderSections } from "../render/clauses";
import { renderGlossary } from "../render/glossary";
import type { ToolDefinition } from "./types";

export const getTerm: ToolDefinition<{ term: z.ZodString }> = {
  name: "get_term",
  description:
    'Returns every definition of one Grand Archive term (name or alias, case-insensitive), in full, with [clause_id] on each clause. Headings as displayed ("Ranged N", "Died/Dies and Kills/Killed"), plurals, verb forms, hyphens and spacing all match the same term. Look up one term per call.',
  inputSchema: { term: z.string() },
  handler: (ctx, { term }) => {
    if (term.trim() === "") {
      return {
        text: 'The term is empty. Pass one term name or alias, e.g. "Bulwark".',
        isError: true,
        count: 0,
      };
    }
    const matches = findTerms(ctx.catalog.terms, term);
    const found = matches[0];
    if (!found) return { text: `No term matching "${term.trim()}" was found.`, count: 0 };
    if (matches.length > 1) {
      return {
        text: `"${term.trim()}" matches several terms: ${matches.map((t) => t.name).join(", ")}. Call get_term with one of them.`,
        count: 0,
      };
    }

    const blocks: string[] = [];
    for (const def of found.definitions) {
      const page = readPage(ctx.db, def.pageId);
      if (!page) continue;
      if (def.sectionId === null && GLOSSARY_PAGE_IDS.includes(def.pageId)) {
        blocks.push(
          renderGlossary(
            page.title,
            page.pageId,
            glossaryTermNames(ctx.catalog.terms, def.pageId),
            generalSections(ctx.catalog.terms, def.pageId, page.sections),
            ctx.catalog.ruleUrls,
          ),
        );
        continue;
      }
      const sections =
        def.sectionId === null
          ? page.sections
          : page.sections.filter((s) => s.sectionId === def.sectionId);
      blocks.push(
        `### ${page.title} (${page.pageId})\n\n${renderSections(sections, ctx.catalog.ruleUrls)}`,
      );
    }
    return { text: [`## ${found.name}`, ...blocks].join("\n\n"), count: blocks.length };
  },
};
