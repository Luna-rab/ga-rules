export type RulingCite = { cardSlug: string; date: string; n: number };

// 条文の引用 ID は "ページID#節:番号"、裁定は "カードslug#ruling:日付:n"
export function formatRulingCiteId(c: RulingCite): string {
  return `${c.cardSlug}#ruling:${c.date}:${c.n}`;
}

// 日付は取得元の date_added そのまま（0 埋めされない "2023-2-6" もある）なので、形は問わない
export function parseRulingCiteId(id: string): RulingCite | null {
  const m = /^([^#]+)#ruling:([^:]+):(\d+)$/.exec(id);
  if (!m) return null;
  return { cardSlug: m[1] ?? "", date: m[2] ?? "", n: Number(m[3]) };
}

export function pageIdOfCiteId(id: string): string {
  const at = id.indexOf("#");
  return at < 0 ? id : id.slice(0, at);
}
