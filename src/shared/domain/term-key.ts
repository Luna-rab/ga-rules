import type { Inflector } from "./inflector";

// 用語の書き方の違いを吸収するキー。ビルドは termKey が同じ見出しを 1 つの用語にまとめ、
// get_term は入力を termKey、見つからなければ looseKey で用語と比べる。

// 書き方を正規化しても届かない派生語 → 用語名。looseKey で比べるので活用形（destroyed）も当たる
export const TERM_SYNONYMS: Readonly<Record<string, string>> = {
  destroy: "Destruction",
  control: "Control and Ownership",
  controller: "Control and Ownership",
  owner: "Control and Ownership",
  ownership: "Control and Ownership",
};

export type TermKeys = {
  // 名詞の複数形だけを単数にする。動詞の活用まで戻すと `Negate` と `Negated`、`Link` と `Linked` のような
  // 別の用語がまとまってしまう
  termKey: (s: string) => string;
  // `Negate` と `Negated` が重なるので、用語をまとめるのには使わない
  looseKey: (s: string) => string;
};

export function createTermKeys(inflector: Inflector): TermKeys {
  return {
    termKey: (s) =>
      words(s)
        .map((w) => inflector.singular(w))
        .join(" "),
    looseKey: (s) => {
      const w = words(s);
      if (w.length >= 2 && w.at(-1) === "phase") w.pop();
      return w.map((x) => inflector.root(x)).join(" ");
    },
  };
}

function words(s: string): string[] {
  const w = s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, "")
    .trim()
    .replace(/:$/, "")
    .replace(/\s+n\+?$/, "")
    .replace(/[-_]/g, " ")
    .trim()
    .split(/\s+/);
  // `Buff Counters`（game-terms）と `Buff`（カウンターのページの見出し）は同じカウンターの定義
  if (w.length >= 2 && /^counters?$/.test(w.at(-1) ?? "")) w.pop();
  return w;
}
