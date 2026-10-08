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

// 抜粋は read/search.ts が端のリンクを丸ごと入れるので、ここは全文に抜粋が見つからなかったときの保険。
// 切れたリンクの残り（書き換えられない `](target)` と、閉じない `[`）を、文言だけにする。
// 末尾が `...` の抜粋の閉じない `[` は、条文が引用するカード名の `[Flawless` なので外さない。
function dropCutLinks(excerpt: string): string {
  const cut = excerpt
    .replace(/^(\.\.\.)?([^[\]]*)\]\((?!https?:\/\/)(?:[^()]|\([^()]*\))*\)/, "$1$2")
    .replace(/\[([^[\]]*)\]\((?!https?:\/\/)(?:[^()[\]]|\([^()[\]]*\))*(?:\([^()[\]]*)?$/, "$1...");
  return cut.endsWith("...") ? cut : cut.replace(/\[([^\]]*)$/, "$1");
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
