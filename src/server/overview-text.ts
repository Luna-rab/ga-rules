// 手書きの部分。中身は後で人が確かめる。直しても索引を作り直さずに済むよう、ここに置く。

export const SERVER_INSTRUCTIONS = `For any question about the Grand Archive TCG, call get_game_overview first, before answering. Then look up the relevant rules or card text with the other tools and answer from the quoted text. Do not answer from memory: this game is not Magic: The Gathering and your prior knowledge of other card games does not apply.

Every rule clause is prefixed with [clause_id] and every card ruling with [cite_id]. Cite these IDs as sources.`;

export const GAME_INTRO = `Grand Archive is a trading card game. It resembles Magic: The Gathering (MTG) and other TCGs on the surface, but it is a different game with its own rules. Your existing knowledge of MTG or other card games cannot be trusted here.`;

export const CONFUSING_TERMS: { term: string; note: string }[] = [
  {
    term: "Opportunity",
    note: "Plays a role similar to priority in MTG, but the word and the rules differ.",
  },
  { term: "Intent", note: "A Grand Archive term with no counterpart in other games." },
  { term: "Materialize", note: "A Grand Archive term with no counterpart in other games." },
  { term: "Recollection", note: "A Grand Archive term with no counterpart in other games." },
];

export const OVERVIEW_CAVEAT = `This overview is only a map of the game. Do not base your answer on it. Before answering, fetch the relevant page with get_rules_page (or get_term, search_rules) and quote it.`;
