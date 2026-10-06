import { renderRuling, type RulingNode } from "./rulings";

export type ClauseHit = { clauseId: string; pageTitle: string; text: string };
export type RulingHit = { ruling: RulingNode; cardCount: number; cardNames: string[] };

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function renderSearchRules(clauses: ClauseHit[], rulings: RulingHit[]): string {
  const clauseLines = clauses.map((c) => `- [${c.clauseId}] (${c.pageTitle}) ${oneLine(c.text)}`);
  const rulingLines = rulings.map((r) => {
    const names = r.cardNames.join(", ");
    const more = r.cardCount > r.cardNames.length ? ", ..." : "";
    const cards = `(attached to ${r.cardCount} card${r.cardCount === 1 ? "" : "s"}: ${names}${more})`;
    return `- ${renderRuling({ ...r.ruling, description: oneLine(r.ruling.description) })} ${cards}`;
  });
  return [
    "## Rule clauses",
    clauseLines.length > 0 ? clauseLines.join("\n") : "(none)",
    "## Card rulings",
    rulingLines.length > 0 ? rulingLines.join("\n") : "(none)",
  ].join("\n\n");
}
