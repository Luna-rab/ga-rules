export type RulingNode = { citeId: string; dateAdded: string; title: string; description: string };

// 裁定の行頭に [cite_id] を付ける。
export function renderRuling(r: RulingNode): string {
  return `[${r.citeId}] ${r.title} (${r.dateAdded}): ${r.description}`;
}
