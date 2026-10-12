import { z } from "zod";
import { getTerm as run } from "../../../application/usecases/get-term";
import { renderSections } from "../../markdown/clauses";
import { renderGlossary } from "../../markdown/glossary";
import type { ToolDefinition } from "./types";

export const getTerm: ToolDefinition<{ term: z.ZodString }> = {
  name: "get_term",
  description:
    'Returns every definition of one Grand Archive term (name or alias, case-insensitive), in full, with [clause_id] on each clause. Headings as displayed ("Ranged N", "Died/Dies and Kills/Killed"), plurals, verb forms, hyphens and spacing all match the same term. Look up one term per call.',
  inputSchema: { term: z.string() },
  handler: (ctx, { term }) => {
    const result = run(ctx, term);
    switch (result.kind) {
      case "empty":
        return {
          text: 'The term is empty. Pass one term name or alias, e.g. "Bulwark".',
          isError: true,
          count: 0,
        };
      case "not-found":
        return { text: `No term matching "${term.trim()}" was found.`, count: 0 };
      case "ambiguous":
        return {
          text: `"${term.trim()}" matches several terms: ${result.names.join(", ")}. Call get_term with one of them.`,
          count: 0,
        };
    }
    const urls = ctx.catalog.ruleUrls;
    const blocks = result.definitions.map((d) =>
      d.kind === "glossary"
        ? renderGlossary(d.glossary, urls)
        : `### ${d.title} (${d.pageId})\n\n${renderSections(d.sections, urls)}`,
    );
    return { text: [`## ${result.name}`, ...blocks].join("\n\n"), count: blocks.length };
  },
};
