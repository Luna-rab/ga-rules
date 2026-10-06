import { renderSections, type SectionNode } from "./clauses";

// general は、どの用語の定義でもない節。一覧の前に条文を載せる
export function renderGlossary(
  title: string,
  pageId: string,
  names: string[],
  general: SectionNode[] = [],
): string {
  return [
    `# ${title} (${pageId})`,
    ...(general.length > 0 ? [renderSections(general)] : []),
    "This page is a glossary. Its term definitions are not returned here; look up one term at a time with get_term.",
    "## Terms",
    names.map((n) => `- ${n}`).join("\n"),
  ].join("\n\n");
}
