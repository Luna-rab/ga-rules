// 検索語を英数字の語に分け、FTS5 の式（どれか 1 語を含む）にする。
// 語は全部クォートするので、AND・NEAR・- や括弧が構文として読まれない。語が無ければ null。
export function toMatchQuery(query: string): string | null {
  const words = [...new Set(query.match(/[\p{L}\p{N}]+/gu) ?? [])];
  if (words.length === 0) return null;
  return words.map((w) => `"${w}"`).join(" OR ");
}
