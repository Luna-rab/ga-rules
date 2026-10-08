import { HINT_EXAMPLE, HINT_EXCEPTION } from "../../shared/hint";
import { citeLink, rewriteRuleLinks, type RuleUrls } from "./rule-links";
import { renderRuling, type RulingNode } from "./rulings";

export type ClauseHit = { clauseId: string; pageTitle: string; url: string; text: string };
export type RulingHit = { ruling: RulingNode; cardCount: number; cardNames: string[] };

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// 例外は条文を打ち消すので外さない
function clauseOneLine(text: string): string {
  const lines = text
    .split("\n")
    .filter((l) => !l.startsWith(HINT_EXAMPLE))
    .map((l) => (l.startsWith(HINT_EXCEPTION) ? `/ ${l}` : l));
  // 節の頭の hint は番号 0 の条文になる。元の本文に戻さないと、その行は引用 ID だけになる
  return oneLine(lines.length > 0 ? lines.join("\n") : text);
}

// snippet が端で切ったリンクの残り（書き換えられない `](target)` と、閉じない `[`）を、文言だけにする
function dropCutLinks(excerpt: string): string {
  return (
    excerpt
      // 先頭が target の途中（`...and-permissions)`・`...p#General Rules)`）なら、閉じ括弧までを落とす
      .replace(/^\.\.\.(?:[^\s()[\]#]*-[^\s()[\]#]*|[^()[\]]*#[^()[\]]*)\)/, "...")
      .replace(/^(\.\.\.)?([^[\]]*)\]\((?!https?:\/\/)(?:[^()]|\([^()]*\))*\)/, "$1$2")
      .replace(
        /\[([^[\]]*)\]\((?!https?:\/\/)(?:[^()[\]]|\([^()[\]]*\))*(?:\([^()[\]]*)?$/,
        "$1...",
      )
      .replace(/\[([^\]]*)$/, "$1")
  );
}

export function renderSearchRules(
  clauses: ClauseHit[],
  rulings: RulingHit[],
  urls: RuleUrls,
): string {
  const clauseLines = clauses.map(
    (c) =>
      `- ${citeLink(c.clauseId, c.url)} (${c.pageTitle}) ${dropCutLinks(clauseOneLine(rewriteRuleLinks(c.text, urls)))}`,
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
