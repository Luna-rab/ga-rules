export type RulingCite = { cardSlug: string; date: string; n: number };

export function formatRulingCiteId(_c: RulingCite): string {
  throw new Error("not implemented");
}

export function parseRulingCiteId(_id: string): RulingCite | null {
  throw new Error("not implemented");
}

export function pageIdOfCiteId(_id: string): string {
  throw new Error("not implemented");
}
