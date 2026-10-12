// 検索語を ASCII の英数字の語に分ける（同じ語は 1 つにする）。索引は英語なので、仮名・漢字は語にしない。
// 語が無ければ null。どれか 1 語を含む条文・裁定が当たる
export function searchWords(query: string): string[] | null {
  const words = [...new Set(query.match(/[A-Za-z0-9]+/g) ?? [])];
  return words.length === 0 ? null : words;
}
