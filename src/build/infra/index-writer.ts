import type { Card, Page, Ruling, Term } from "../domain/model";
import type { Relations } from "../domain/relate";

export type IndexData = {
  pages: Page[];
  terms: Term[];
  cards: Card[];
  rulings: Ruling[];
  relations: Relations;
};

// outPath の横の一時ファイルに PRAGMA foreign_keys=ON で書き、FTS を rebuild してから outPath へ rename する
export async function writeIndex(_outPath: string, _data: IndexData): Promise<void> {
  throw new Error("not implemented");
}
