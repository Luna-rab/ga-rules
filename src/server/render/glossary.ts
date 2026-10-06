export function renderGlossary(title: string, pageId: string, names: string[]): string {
  return [
    `# ${title} (${pageId})`,
    "This page is a glossary. Its clauses are not returned here; look up one term at a time with get_term.",
    "## Terms",
    names.map((n) => `- ${n}`).join("\n"),
  ].join("\n\n");
}
