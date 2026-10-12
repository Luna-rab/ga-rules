import type { PageNode, TocEntry } from "../../domain/model";
import type { ToolContext } from "../context";

export type GameOverview = { overview: PageNode[]; toc: TocEntry[] };

// 概要のページと目次は起動時に catalog へ読んである
export function getGameOverview(ctx: ToolContext): GameOverview {
  return { overview: ctx.catalog.overview, toc: ctx.catalog.toc };
}
