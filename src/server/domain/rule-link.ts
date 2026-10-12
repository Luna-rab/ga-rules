// 条文の本文にあるルール文書へのリンク [文言](target)。target は page_id か section_id。
// target は節見出しを含むので、空白と 1 段の括弧（例: game-terms#Lineage (term)）を許す。
// /g の正規表現は lastIndex を持ち回すので外に出さず、使うたびに作る
const ruleLink = () => /\[([^\]]*)\]\(((?:[^()]|\([^()]*\))+)\)/g;

// 本文にあるリンク 1 本ごとの [開始, 終了) の位置
export function linkSpans(text: string): [number, number][] {
  return [...text.matchAll(ruleLink())].map((m) => [m.index, m.index + m[0].length]);
}

// リンクを 1 本ずつ replace の戻り値に置き換える
export function replaceRuleLinks(
  text: string,
  replace: (link: { whole: string; label: string; target: string }) => string,
): string {
  return text.replace(ruleLink(), (whole, label: string, target: string) =>
    replace({ whole, label, target }),
  );
}
