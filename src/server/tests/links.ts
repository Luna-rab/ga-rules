// ツールの出力に残った、書き換わっていないページへのリンクの target。
// 書き換え後のリンクは `[文言](https://...) [target]` なので、`](` の直後は URL になる。
export function unrewrittenLinks(text: string): string[] {
  return [...text.matchAll(/\]\((?!https?:\/\/)[^\n]*/g)].map((m) => m[0]);
}
