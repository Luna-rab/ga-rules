// 正規表現の選択（|）を長い名前から並べる。同じ位置では先に並んだ長い名前が当たり、
// 当たった範囲は読み飛ばされるので、Element Bonus の中の Element を二重に数えない
export class Matcher<K> {
  private readonly keysByName = new Map<string, K[]>();
  private readonly pattern: RegExp | null;

  constructor(entries: { key: K; names: string[] }[]) {
    for (const { key, names } of entries) {
      for (const name of names) {
        const lower = name.toLowerCase();
        const keys = this.keysByName.get(lower) ?? [];
        if (!keys.includes(key)) keys.push(key);
        this.keysByName.set(lower, keys);
      }
    }
    const names = [...this.keysByName.keys()].toSorted((a, b) => b.length - a.length);
    // \b は名前の端が記号（On Enter: など）だと効かないので、前後に英数字が無いことを見る
    this.pattern =
      names.length === 0
        ? null
        : new RegExp(
            `(?<![\\p{L}\\p{N}_])(${names.map(escape).join("|")})s?(?![\\p{L}\\p{N}_])`,
            "giu",
          );
  }

  // 当たったキーを重複なしで返す
  match(text: string): K[] {
    if (this.pattern === null) return [];
    const found = new Set<K>();
    for (const m of text.matchAll(this.pattern)) {
      for (const key of this.keysByName.get(m[1]!.toLowerCase()) ?? []) found.add(key);
    }
    return [...found];
  }
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
