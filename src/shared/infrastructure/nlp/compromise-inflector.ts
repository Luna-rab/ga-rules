import nlp from "compromise";
import type { Inflector } from "../../domain/inflector";

// compromise は 1 語ごとに品詞を推測するので遅い。語の種類は数百なので覚えておく
const singularCache = new Map<string, string>();
const rootCache = new Map<string, string>();

export const compromiseInflector: Inflector = {
  singular(word) {
    let s = singularCache.get(word);
    if (s === undefined) {
      const doc = nlp(word);
      doc.tag("Noun");
      s = doc.nouns().toSingular().text().toLowerCase() || word;
      singularCache.set(word, s);
    }
    return s;
  },
  root(word) {
    let r = rootCache.get(word);
    if (r === undefined) {
      const doc = nlp(word);
      doc.compute("root");
      r = doc.text("root").toLowerCase() || word;
      rootCache.set(word, r);
    }
    return r;
  },
};
