import { cardUrl } from "../../../shared/domain/site-url";
import type { CardCost, CardDetail, CardSummary, RuleUrls } from "../../domain/model";
import { citeLink, rewriteRuleLinks } from "./rule-links";
import { renderRuling } from "./rulings";

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
    c.frontSlug === null ? "" : `back face of ${c.frontSlug}`,
  ].filter((p) => p !== "");
  const effect = c.effectRaw ? oneLine(c.effectRaw) : "";
  const tail = detail ?? (effect.length > 100 ? `${effect.slice(0, 100)}…` : effect);
  return `- ${c.name} (${c.slug}) | ${parts.join(" | ")}${tail ? ` — ${tail}` : ""}`;
}

function field(label: string, values: string[]): string[] {
  return values.length > 0 ? [`- ${label}: ${values.join(", ")}`] : [];
}

function faceFields(c: CardSummary): string[] {
  return [
    ...field("Types", c.types),
    ...field("Subtypes", c.subtypes),
    ...field("Classes", c.classes),
    ...field("Elements", c.elements),
    ...field("Stats", stats(c)),
  ];
}

function section(heading: string, lines: string[]): string[] {
  return lines.length > 0 ? ["", `### ${heading}`, ...lines] : [];
}

export function renderCardDetail(c: CardDetail, urls: RuleUrls): string {
  const legality = c.legality
    ? Object.entries(c.legality).map(([f, limit]) => `${f} limit ${limit ?? "none"}`)
    : [];
  const front = c.frontFace;
  return [
    `## ${c.name} (${c.slug}) (${cardUrl(c.slug)})`,
    ...(front ? [`- Back face of: ${front.name} (${front.slug})`] : []),
    ...faceFields(c),
    ...field("Legality", legality),
    ...(c.effectRaw ? ["", "### Effect", c.effectRaw] : []),
    ...(c.backFace
      ? [
          "",
          `### Back face: ${c.backFace.name} (${c.backFace.slug}) (${cardUrl(c.backFace.slug)})`,
          ...faceFields(c.backFace),
          ...(c.backFace.effectRaw ? ["- Effect:", c.backFace.effectRaw] : []),
        ]
      : []),
    ...section(
      front ? `Rulings (filed under the front, ${front.slug})` : "Rulings",
      c.rulings.map(renderRuling),
    ),
    ...section(
      "Terms",
      c.terms.map(
        (t) => `- ${t.name}: ${t.definitionIds.map((id) => citeLink(id, urls.get(id))).join(" ")}`,
      ),
    ),
    ...section(
      "Referenced cards",
      c.references.map((r) => `- ${r.name} (${r.slug}) — ${r.kind}`),
    ),
    ...section(
      "Rules clauses that mention this card",
      c.clauses.map((cl) => `${citeLink(cl.clauseId, cl.url)} ${rewriteRuleLinks(cl.text, urls)}`),
    ),
    ...section("Rulings on other cards that mention this card", c.otherRulings.map(renderRuling)),
  ].join("\n");
}
