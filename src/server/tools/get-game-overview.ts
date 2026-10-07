import type { z } from "zod";
import { CONFUSING_TERMS, GAME_INTRO, OVERVIEW_CAVEAT } from "../overview-text";
import { renderSections } from "../render/clauses";
import type { ToolDefinition } from "./types";

export const getGameOverview: ToolDefinition<z.ZodRawShape> = {
  name: "get_game_overview",
  description:
    "Returns an overview of the Grand Archive TCG: what the game is, terms easily confused with other card games, excerpts of the core rules, and the table of contents of the rules documents. Call this first whenever the topic is Grand Archive.",
  inputSchema: {},
  handler: (ctx) => {
    const { toc, overview } = ctx.catalog;

    const confusing = CONFUSING_TERMS.map((t) => `- ${t.term}: ${t.note}`).join("\n");
    const excerpts = overview
      .map((p) => `### ${p.title} (${p.pageId})\n\n${renderSections(p.sections)}`)
      .join("\n\n");
    const contents = toc.map((e) => `${"  ".repeat(e.depth)}${e.title} | ${e.pageId}`).join("\n");

    const text = [
      "# Grand Archive overview",
      GAME_INTRO,
      "## Terms easily confused with other games",
      confusing,
      "## How to use this overview",
      OVERVIEW_CAVEAT,
      "## Rules excerpts",
      excerpts,
      "## Table of contents (title | page_id)",
      contents,
    ].join("\n\n");

    return { text, count: overview.length };
  },
};
