import type { GlossaryPage } from "../../domain/glossary";
import type { RuleUrls } from "../../domain/model";
import { renderSections } from "./clauses";

// どの用語の定義でもない節は、一覧の前に条文を載せる
export function renderGlossary(g: GlossaryPage, urls: RuleUrls): string {
  return [
    `# ${g.title} (${g.pageId})`,
    ...(g.general.length > 0 ? [renderSections(g.general, urls)] : []),
    "This page is a glossary. Its term definitions are not returned here; look up one term at a time with get_term.",
    "## Terms",
    g.termNames.map((n) => `- ${n}`).join("\n"),
  ].join("\n\n");
}
