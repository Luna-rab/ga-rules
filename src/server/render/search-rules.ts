import { renderRuling, type RulingNode } from "./rulings";

export type ClauseHit = { clauseId: string; pageTitle: string; text: string };
export type RulingHit = { ruling: RulingNode; cardCount: number; cardNames: string[] };

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// ビルドが hint を「例: 」「例外: 」で始まる 1 行にまとめている前提。例外は条文を打ち消すので外さない
function clauseOneLine(text: string): string {
  const lines = text
    .split("\n")
    .filter((l) => !l.startsWith("例: "))
    .map((l) => (l.startsWith("例外: ") ? `/ ${l}` : l));
  // 節の頭の hint は番号 0 の条文になる。元の本文に戻さないと、その行は引用 ID だけになる
  return oneLine(lines.length > 0 ? lines.join("\n") : text);
}

export function renderSearchRules(clauses: ClauseHit[], rulings: RulingHit[]): string {
  const clauseLines = clauses.map(
    (c) => `- [${c.clauseId}] (${c.pageTitle}) ${clauseOneLine(c.text)}`,
  );
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
