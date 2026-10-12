// 語の並びを FTS5 の MATCH の式にする。語は全部クォートし、語の中の " は "" に重ねるので、
// AND・NEAR・- や括弧が構文として読まれない。空の並びは式にならないので、呼ぶ側で除く
const quote = (w: string) => `"${w.replaceAll('"', '""')}"`;

export const anyWord = (words: string[]): string => words.map(quote).join(" OR ");

export const allWords = (words: string[]): string => words.map(quote).join(" ");
