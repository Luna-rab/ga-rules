import { type ClauseNode, renderClause } from "./clauses";
import { type RulingNode, renderRuling } from "./rulings";

export type CardCost = { type: string | null; value: string | null };

export type CardSummary = {
  slug: string;
  name: string;
  types: string[];
  subtypes: string[];
  classes: string[];
  elements: string[];
  cost: CardCost;
  level: number | null;
  power: number | null;
  life: number | null;
  durability: number | null;
  speed: boolean | null;
  effectRaw: string | null;
};

export type CardDetail = CardSummary & {
  // formats 名 → limit（0 なら禁止）
  legality: Record<string, number | null> | null;
  rulings: RulingNode[];
  // definitionIds は用語の定義の引用 ID（節 ID、ページ全体ならページ ID）
  terms: { name: string; definitionIds: string[] }[];
  references: { slug: string; name: string; kind: string }[];
  clauses: ClauseNode[];
  otherRulings: RulingNode[];
};

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

function renderCost(c: CardCost): string | null {
  if (c.type === null) return null;
  return c.value === null ? c.type : `${c.type} ${c.value}`;
}

function stats(c: CardSummary): string[] {
  const out: string[] = [];
  const cost = renderCost(c.cost);
  if (cost !== null) out.push(`cost ${cost}`);
  for (const key of ["level", "power", "life", "durability"] as const) {
    if (c[key] !== null) out.push(`${key} ${c[key]}`);
  }
  if (c.speed !== null) out.push(c.speed ? "fast" : "slow");
  return out;
}

// 1 枚 1 行。detail は行の末尾に足す抜粋（無ければ効果の冒頭 100 字）。
export function renderCardLine(c: CardSummary, detail?: string): string {
  const parts = [
    [...c.types, ...c.subtypes].join(" "),
    c.classes.join("/"),
    c.elements.join("/"),
    ...stats(c),
  ].filter((p) => p !== "");
  const effect = c.effectRaw ? oneLine(c.effectRaw) : "";
  const tail = detail ?? (effect.length > 100 ? `${effect.slice(0, 100)}…` : effect);
  return `- ${c.name} (${c.slug}) | ${parts.join(" | ")}${tail ? ` — ${tail}` : ""}`;
}

function field(label: string, values: string[]): string[] {
  return values.length > 0 ? [`- ${label}: ${values.join(", ")}`] : [];
}

function section(heading: string, lines: string[]): string[] {
  return lines.length > 0 ? ["", `### ${heading}`, ...lines] : [];
}

export function renderCardDetail(c: CardDetail): string {
  const legality = c.legality
    ? Object.entries(c.legality).map(([f, limit]) => `${f} limit ${limit ?? "none"}`)
    : [];
  return [
    `## ${c.name} (${c.slug})`,
    ...field("Types", c.types),
    ...field("Subtypes", c.subtypes),
    ...field("Classes", c.classes),
    ...field("Elements", c.elements),
    ...field("Stats", stats(c)),
    ...field("Legality", legality),
    ...(c.effectRaw ? ["", "### Effect", c.effectRaw] : []),
    ...section("Rulings", c.rulings.map(renderRuling)),
    ...section(
      "Terms",
      c.terms.map((t) => `- ${t.name}: ${t.definitionIds.map((id) => `[${id}]`).join(" ")}`),
    ),
    ...section(
      "Referenced cards",
      c.references.map((r) => `- ${r.name} (${r.slug}) — ${r.kind}`),
    ),
    ...section("Rules clauses that mention this card", c.clauses.map(renderClause)),
    ...section("Rulings on other cards that mention this card", c.otherRulings.map(renderRuling)),
  ].join("\n");
}
