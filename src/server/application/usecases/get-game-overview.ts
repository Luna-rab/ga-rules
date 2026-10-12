import type { PageNode, TocEntry } from "../../domain/model";
import type { ToolContext } from "../context";

export type GameOverview = { overview: PageNode[]; toc: TocEntry[] };

export function getGameOverview(ctx: ToolContext): GameOverview {
  return { overview: ctx.catalog.overview, toc: ctx.catalog.toc };
}
