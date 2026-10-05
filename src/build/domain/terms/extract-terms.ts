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

  // 語彙にするのは `####` の節だけ。`###`・行頭の太字の節（minor）は規則の小見出しで用語ではなく、
  // 最初の見出しより前の本文の節（lead）は、下のページ題の定義と同じ語になる
  for (const page of pages) {
    for (const section of page.sections) {
      if (section.kind !== "heading") continue;
      add(section.heading, { pageId: page.pageId, sectionId: section.sectionId });
    }
  }
  // ページ題の定義はページ全体を指す。get_term は定義をすべて返す
  for (const page of pages) {
    add(page.title.split(" - ").at(-1)!, { pageId: page.pageId, sectionId: null });
  }

  return [...byName.values()];
}

// "Died/Dies and Kills/Killed" → ["Died", "Dies", "Kills", "Killed"]。先頭が名前、残りが別名。
// ` and ` で分けるのは `/` の組を並べた見出しだけ。"Control and Ownership"・
// "Properties and States of Objects"・"Copying Abilities, Card Activations, and Materializations"
// は別々の語の並びではなく 1 つの題なので、分けずに全体を名前にする
function splitHeading(heading: string): string[] {
  const cleaned = heading
    .replace(/<a\b[^>]*>\s*<\/a>/g, "")
    .replace(/\s*\([^)]*\)/g, "")
    .trim()
    .replace(/:$/, "")
    .replace(/\s+N\+?$/, "")
    .trim();
  return cleaned
    .split(cleaned.includes("/") ? /\s*\/\s*|\s+and\s+/ : /\s*\/\s*/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
}
