import type { z } from "zod";
import {
  BASIC_TERMS,
  ELEMENT_NOTE,
  ELEMENTS,
  GAME_FLOW,
  GAME_INTRO,
  OVERVIEW_CAVEAT,
  PROPER_NOUN_RULE,
  TERM_MAPPINGS,
} from "../overview-text";
import { renderSections } from "../render/clauses";
import type { ToolDefinition } from "./types";

export const getGameOverview: ToolDefinition<z.ZodRawShape> = {
  name: "get_game_overview",
  description:
    "Returns an overview of the Grand Archive TCG: what the game is, terms easily confused with other card games, excerpts of the core rules, and the table of contents of the rules documents. Call this first whenever the topic is Grand Archive.",
  inputSchema: {},
  handler: (ctx) => {
    const { toc, overview } = ctx.catalog;

    const mappings = [
      "| Term from other games | Grand Archive term | Look up |",
      "| --- | --- | --- |",
      ...TERM_MAPPINGS.map((m) => `| ${m.from} | ${m.to} | ${m.lookup} |`),
    ].join("\n");
    const terms = BASIC_TERMS.map((t) => `- ${t.term}: ${t.definition} (${t.lookup})`).join("\n");
    const flow = GAME_FLOW.map((l) => `- ${l}`).join("\n");
    const elements = [
      ...ELEMENTS.map((e) => {
        // Norm・Exalted は群の名前とエレメントの名前が同じなので、群の名前だけを書く
        const names = e.names.join(", ");
        const label = names === e.group ? names : `${e.group}: ${names}`;
        return `- ${label}${e.note ? ` — ${e.note}` : ""}`;
      }),
      "",
      ELEMENT_NOTE,
    ].join("\n");
    const excerpts = overview
      .map((p) => `### ${p.title} (${p.pageId})\n\n${renderSections(p.sections)}`)
      .join("\n\n");
    const contents = toc.map((e) => `${"  ".repeat(e.depth)}${e.title} | ${e.pageId}`).join("\n");

    const text = [
      "# Grand Archive overview",
      PROPER_NOUN_RULE,
      GAME_INTRO,
      "## How to use this overview",
      OVERVIEW_CAVEAT,
      "## Terms from other games",
      mappings,
      "## Basic terms",
      terms,
      "## Game flow",
      flow,
      "## Elements",
      elements,
      "## Rules excerpts",
      excerpts,
      "## Table of contents (title | page_id)",
      contents,
    ].join("\n\n");

    return { text, count: overview.length };
  },
};
