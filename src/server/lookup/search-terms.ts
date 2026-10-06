// 検索語を英数字（ASCII）の語に分け。索引は英語なので、仮名・漢字は語にしない、FTS5 の式（どれか 1 語を含む）にする。
// 語は全部クォートするので、AND・NEAR・- や括弧が構文として読まれない。語が無ければ null。
export function toMatchQuery(query: string): string | null {
  const words = [...new Set(query.match(/[A-Za-z0-9]+/g) ?? [])];
  if (words.length === 0) return null;
  return words.map((w) => `"${w}"`).join(" OR ");
}
