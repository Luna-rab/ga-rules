import type { Card, LinkTarget } from "../model";

export type Correction =
  | { kind: "card-reference"; cardSlug: string; from: string; to: string; reason: string } // references[].slug を直す
  | { kind: "rule-link"; path: string; from: string; to: LinkTarget | null; reason: string }; // path は RawPage.path、from はリンクの括弧内そのまま。null はリンクを外して文字だけ残す

export const CORRECTIONS: readonly Correction[] = [];

export function applyCardCorrections(_cards: Card[], _corrections: readonly Correction[]): Card[] {
  throw new Error("not implemented");
}
