import { findCards } from "./find-cards";
import { getCard } from "./get-card";
import { getGameOverview } from "./get-game-overview";
import { getRulesPage } from "./get-rules-page";
import { getTerm } from "./get-term";
import { searchCards } from "./search-cards";
import { searchRules } from "./search-rules";
import type { ToolDefinition } from "./types";

// oxlint-disable-next-line typescript/no-explicit-any
export const TOOLS: ToolDefinition<any>[] = [
  getGameOverview,
  getRulesPage,
  getTerm,
  searchRules,
  findCards,
  searchCards,
  getCard,
];
