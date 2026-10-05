import type { Page, Term, TermDefinition } from "../model";

const EXCLUDED = new Set(["general rules"]);

export function extractTerms(pages: Page[]): Term[] {
  const byName = new Map<string, Term>();

  const add = (heading: string, def: TermDefinition) => {
    const [name, ...aliases] = splitHeading(heading);
    if (name === undefined || EXCLUDED.has(name.toLowerCase())) return;
    let term = byName.get(name.toLowerCase());
    if (term === undefined) {
      term = { termId: byName.size + 1, name, aliases: [], definitions: [] };
      byName.set(name.toLowerCase(), term);
    }
    for (const alias of aliases) {
      const lower = alias.toLowerCase();
      if (
        lower !== term.name.toLowerCase() &&
        !term.aliases.some((a) => a.toLowerCase() === lower)
      ) {
        term.aliases.push(alias);
      }
    }
    if (!term.definitions.some((d) => d.pageId === def.pageId && d.sectionId === def.sectionId)) {
      term.definitions.push(def);
    }
  };

  for (const page of pages) {
    for (const section of page.sections) {
      add(section.heading, { pageId: page.pageId, sectionId: section.sectionId });
    }
  }
  // 最初の #### より前の本文は、ページ題の最後の区切りを見出しにした節になる（parseRules）。
  // その節から定義ができたページには、同じ用語にページ全体の定義を重ねて足さない
  for (const page of pages) {
    const title = page.title.split(" - ").at(-1)!;
    const name = splitHeading(title)[0];
    const existing = name === undefined ? undefined : byName.get(name.toLowerCase());
    if (existing?.definitions.some((d) => d.pageId === page.pageId)) continue;
    add(title, { pageId: page.pageId, sectionId: null });
  }

  return [...byName.values()];
}

// "Died/Dies and Kills/Killed" → ["Died", "Dies", "Kills", "Killed"]。先頭が名前、残りが別名。
// "A, B, and C" のカンマも区切りにし、名前の末尾にカンマを残さない
function splitHeading(heading: string): string[] {
  const cleaned = heading
    .replace(/<a\b[^>]*>\s*<\/a>/g, "")
    .replace(/\s*\([^)]*\)/g, "")
    .trim()
    .replace(/:$/, "")
    .replace(/\s+N$/, "")
    .trim();
  return cleaned
    .split(/\s*\/\s*|\s*,\s*(?:and\s+)?|\s+and\s+/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
}
