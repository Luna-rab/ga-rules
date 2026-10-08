import { rulingUrl } from "../../shared/site-url";
import { citeLink } from "./rule-links";

export type RulingNode = { citeId: string; dateAdded: string; title: string; description: string };

// 裁定の行頭に [cite_id](カードの URL) を付ける。URL が引けなければ [cite_id]。
export function renderRuling(r: RulingNode): string {
  return `${citeLink(r.citeId, rulingUrl(r.citeId) ?? undefined)} ${r.title} (${r.dateAdded}): ${r.description}`;
}
