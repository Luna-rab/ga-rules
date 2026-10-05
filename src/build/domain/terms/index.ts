import type { Page, Term } from "../model";

export function extractTerms(_pages: Page[]): Term[] {
  throw new Error("not implemented");
}

export class Matcher<K> {
  constructor(_entries: { key: K; names: string[] }[]) {
    throw new Error("not implemented");
  }

  // 当たったキーを重複なしで返す
  match(_text: string): K[] {
    throw new Error("not implemented");
  }
}
