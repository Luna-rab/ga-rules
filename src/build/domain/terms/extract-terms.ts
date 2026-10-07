import { TERM_SYNONYMS, termKey } from "../../../shared/term-key";
import { DataError } from "../errors";
import type { Page, Section, Term, TermDefinition } from "../model";

const EXCLUDED = new Set(["general rules"]);
// 条文の箇条書き `- 名前: 説明` が用語の定義になっている節
const LISTED_TERM_SECTIONS = new Set(["game-terms#Label Keywords"]);

export function extractTerms(pages: Page[]): Term[] {
  const byKey = new Map<string, Term>();

  const add = (heading: string, def: TermDefinition) => {
    const [name, ...aliases] = splitHeading(heading);
    if (name === undefined || EXCLUDED.has(name.toLowerCase())) return;
    const key = termKey(name);
    let term = byKey.get(key);
    if (term === undefined) {
      term = { termId: byKey.size + 1, name, aliases: [], definitions: [] };
      byKey.set(key, term);
    }
    for (const alias of [name, ...aliases]) {
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

  // `####` の節の見出しが用語。最初の見出しより前の本文の節（lead）は、下のページ題の定義と同じ語になる。
  // `###`・行頭の太字の節（minor）は `Deleveling` のような用語だが、末尾が `:` の前置き（`Masteries:`）と
  // 番号付きの手順（`1.1 Announcing Activation`）は外す
  for (const page of pages) {
    for (const section of page.sections) {
      if (section.kind === "lead") continue;
      if (section.kind === "minor" && /:$|^\d+(\.\d+)*\s/.test(section.heading.trim())) continue;
      const def = { pageId: page.pageId, sectionId: section.sectionId };
      add(section.heading, def);
      for (const name of namesInClauses(section)) add(name, def);
    }
  }
  // ページ題の定義はページ全体を指す。get_term は定義をすべて返す
  for (const page of pages) {
    add(page.title.split(" - ").at(-1)!, { pageId: page.pageId, sectionId: null });
  }

  return [...byKey.values()];
}

// LISTED_TERM_SECTIONS と TERM_SYNONYMS は節 ID と用語名を名指しするので、ルール文書の改訂で
// 名前が変わると黙って効かなくなる。索引を書く前に止める
export function assertTermSources(pages: Page[], terms: Term[]): void {
  const sections = new Map(pages.flatMap((p) => p.sections.map((s) => [s.sectionId, s])));
  for (const id of LISTED_TERM_SECTIONS) {
    const section = sections.get(id);
    if (section === undefined || namesInClauses(section).length === 0) {
      throw new DataError(id, "用語の箇条書きが見つからない");
    }
  }
  const names = new Set(terms.map((t) => t.name));
  for (const [word, name] of Object.entries(TERM_SYNONYMS)) {
    if (!names.has(name)) throw new DataError(`TERM_SYNONYMS.${word}`, `用語 ${name} が無い`);
  }
}

// 見出しではなく条文に名前が書かれた用語。
// - LISTED_TERM_SECTIONS の箇条書き `- Deluge N: ...` の名前
// - 番号に `.` の無い条文で、句読点を持たず下位の条文を持つもの。機能サブタイプの
//   `Siegeable`・`Gun / Bow / Aetherwing` のように、条文が小見出しの役をしている。`/` の語は別々の用語
function namesInClauses(section: Section): string[] {
  const names: string[] = [];
  if (LISTED_TERM_SECTIONS.has(section.sectionId)) {
    for (const c of section.clauses) {
      for (const m of c.text.matchAll(/^- ([^:\n]+):/gm)) names.push(m[1]!);
    }
  }
  for (const c of section.clauses) {
    if (c.number === "0" || c.number.includes(".") || /[.:;,]/.test(c.text)) continue;
    if (!section.clauses.some((sub) => sub.number.startsWith(`${c.number}.`))) continue;
    names.push(...c.text.split("/"));
  }
  return names;
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
