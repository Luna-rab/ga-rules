import type { TermKeys } from "../../shared/domain/term-key";
import type { Catalog } from "../domain/model";
import type { CardRepository, RuleRepository } from "./ports";

export type ToolContext = {
  rules: RuleRepository;
  cards: CardRepository;
  catalog: Catalog;
  termKeys: TermKeys;
};
