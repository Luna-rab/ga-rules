import type { Card, RawPage } from "../domain/model";

export function readRules(dataDir: string): Promise<RawPage[]> {
  throw new Error(`not implemented: readRules(${dataDir})`);
}

export function readCards(dataDir: string): Promise<Card[]> {
  throw new Error(`not implemented: readCards(${dataDir})`);
}
