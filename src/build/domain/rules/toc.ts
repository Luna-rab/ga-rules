import type { Page, TocEntry } from "../model";

export function parseToc(_summaryMarkdown: string, _pages: Page[]): TocEntry[] {
  throw new Error("not implemented");
}

export function assertOverviewPages(_pages: Page[]): void {
  throw new Error("not implemented");
}
