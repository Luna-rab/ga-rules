// 条文の本文にあるルール文書へのリンク [文言](target)。target は page_id か section_id。
// target は節見出しを含むので、空白と 1 段の括弧（例: game-terms#Lineage (term)）を許す
export const RULE_LINK = /\[([^\]]*)\]\(((?:[^()]|\([^()]*\))+)\)/g;

// 本文にあるリンク 1 本ごとの [開始, 終了) の位置
export function linkSpans(text: string): [number, number][] {
  return [...text.matchAll(RULE_LINK)].map((m) => [m.index, m.index + m[0].length]);
}
