import nlp from "compromise";

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

// 名詞の複数形だけを単数にする。動詞の活用まで戻すと `Negate` と `Negated`、`Link` と `Linked` のような
// 別の用語がまとまってしまう
export function termKey(s: string): string {
  return words(s).map(singular).join(" ");
}

// `Negate` と `Negated` が重なるので、用語をまとめるのには使わない
export function looseKey(s: string): string {
  const w = words(s);
  if (w.length >= 2 && w.at(-1) === "phase") w.pop();
  return w.map(root).join(" ");
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

// compromise は 1 語ごとに品詞を推測するので遅い。語の種類は数百なので覚えておく
const singularCache = new Map<string, string>();
const rootCache = new Map<string, string>();

function singular(word: string): string {
  let s = singularCache.get(word);
  if (s === undefined) {
    const doc = nlp(word);
    doc.tag("Noun");
    s = doc.nouns().toSingular().text().toLowerCase() || word;
    singularCache.set(word, s);
  }
  return s;
}

function root(word: string): string {
  let r = rootCache.get(word);
  if (r === undefined) {
    const doc = nlp(word);
    doc.compute("root");
    r = doc.text("root").toLowerCase() || word;
    rootCache.set(word, r);
  }
  return r;
}
