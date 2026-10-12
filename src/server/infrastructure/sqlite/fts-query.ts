// 語の並びを FTS5 の MATCH の式にする。語は全部クォートするので、AND・NEAR・- や括弧が構文として読まれない。
// 語は英数字だけ（domain/search-terms.ts・domain/card-query.ts が分ける）なので、語の中に " は無い。
const quote = (w: string) => `"${w}"`;

export const anyWord = (words: string[]): string => words.map(quote).join(" OR ");

export const allWords = (words: string[]): string => words.map(quote).join(" ");
