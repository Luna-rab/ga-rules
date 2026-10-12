import type { Card, Page, RawPage, Ruling, Term, TocEntry } from "../domain/model";
import type { Relations } from "../domain/relate";

// fetch:data が取得した原本を読む
export type RawSource = {
  readRules: () => Promise<RawPage[]>;
  // GitBook の目次 SUMMARY.md
  readSummary: () => Promise<string>;
  readCards: () => Promise<Card[]>;
};

export type IndexData = {
  pages: Page[];
  toc: TocEntry[];
  terms: Term[];
  cards: Card[];
  rulings: Ruling[];
  relations: Relations;
};

// 途中で失敗したら、書き込み先に何も残さない
export type IndexWriter = {
  write: (data: IndexData) => Promise<void>;
};
