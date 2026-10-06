import { OVERVIEW_PAGE_IDS } from "../../../shared/overview";
import { DataError } from "../errors";
import type { Page, TocEntry } from "../model";
import { pageIdOf } from "./index";

const ITEM = /^( *)\* \[[^\]]*\]\(([^)]*)\)/;
// 変更履歴と目次そのものは、ルールのページとして取り込まない
const SKIPPED_PATHS = new Set(["README.md", "table-of-contents.md"]);

export function parseToc(summaryMarkdown: string, pages: Page[]): TocEntry[] {
  const entries: TocEntry[] = [];
  const stack: { indent: number; pageId: string }[] = [];
  for (const line of summaryMarkdown.split(/\r?\n/)) {
    const m = ITEM.exec(line);
    if (!m) continue;
    const path = (m[2] ?? "").replace(/^<(.*)>$/, "$1");
    if (SKIPPED_PATHS.has(path)) continue;
    const indent = (m[1] ?? "").length;
    while (stack.length > 0 && (stack.at(-1)?.indent ?? 0) >= indent) stack.pop();
    const pageId = pageIdOf(path);
    entries.push({
      pageId,
      parentPageId: stack.at(-1)?.pageId ?? null,
      position: entries.length,
    });
    stack.push({ indent, pageId });
  }

  const known = new Set(pages.map((p) => p.pageId));
  const listed = new Set(entries.map((e) => e.pageId));
  for (const e of entries) {
    if (!known.has(e.pageId)) {
      throw new DataError("SUMMARY.md", `目次にあるページ ${e.pageId} が data/rules に無い`);
    }
  }
  for (const p of pages) {
    if (!listed.has(p.pageId)) {
      throw new DataError("SUMMARY.md", `ページ ${p.pageId} が目次に無い`);
    }
  }
  return entries;
}

export function assertOverviewPages(pages: Page[]): void {
  const known = new Set(pages.map((p) => p.pageId));
  const missing = OVERVIEW_PAGE_IDS.filter((id) => !known.has(id));
  if (missing.length > 0) {
    throw new DataError("overview", `概要に使うページが無い: ${missing.join(", ")}`);
  }
}
