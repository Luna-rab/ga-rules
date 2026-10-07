// 手書きの部分。中身は後で人が確かめる。直しても索引を作り直さずに済むよう、ここに置く。

export const SERVER_INSTRUCTIONS = `For any question about the Grand Archive TCG, call get_game_overview first, before answering. Then look up the relevant rules or card text with the other tools and answer from the quoted text. Do not answer from memory: this game is not Magic: The Gathering and your prior knowledge of other card games does not apply.

Every rule clause is prefixed with [clause_id] and every card ruling with [cite_id]. Cite these IDs as sources.`;

export const PROPER_NOUN_RULE = `Keep Grand Archive proper nouns in English — card names, keywords, game terms, zone and phase names — even when you answer in another language. Write "material deck", not "素材デッキ".`;

export const GAME_INTRO = `Grand Archive is a trading card game. It resembles Magic: The Gathering (MTG) and other TCGs on the surface, but it is a different game with its own rules. Your existing knowledge of MTG or other card games cannot be trusted here.`;

export const OVERVIEW_CAVEAT = `This overview is only a map of the game. Do not base your answer on it. Before answering, fetch the relevant page with get_rules_page (or get_term, search_rules) and quote it.`;

export const TERM_MAPPINGS: { from: string; to: string; lookup: string }[] = [
  { from: "exile", to: "Banish (to the Banishment zone)", lookup: '`get_term("Banish")`' },
  { from: "priority", to: "Opportunity", lookup: '`get_term("Opportunity")`' },
  {
    from: "block / blocker",
    to: "There is no blocking. Intercept: an awake ally may redirect an attack on your champion to itself. Taunt: awake units with Taunt must be attacked first. Retaliation: a defending unit rests to deal damage back to the attacker.",
    lookup: '`get_term("Intercept")`, `get_term("Taunt")`, `get_term("Retaliate")`',
  },
  {
    from: "tap / untap",
    to: "Rest / Wake Up",
    lookup: '`get_term("Rest")`, `get_term("Wake Up")`',
  },
  {
    from: "mana",
    to: "There is no mana. Reserve cost: put that many cards from your hand face-down into memory. Memory cost: banish that many random cards from memory.",
    lookup: '`get_term("Reserve")`, `parts-of-a-card-cost`',
  },
  {
    from: "heal",
    to: "Recover (remove damage counters from your champion)",
    lookup: '`get_term("Recover")`',
  },
  { from: "stack", to: "Effects Stack", lookup: "`game-zones-effects-stack`" },
  {
    from: "cast / play a spell",
    to: "Activate (take a card from hand, pay its cost, put it on the Effects Stack)",
    lookup: '`get_term("Activate")`',
  },
  {
    from: "counter a spell",
    to: "Negate (the negated activation does not resolve; the card then goes to the Graveyard, or to Banishment if it has a memory cost; paid costs are not refunded)",
    lookup: '`get_term("Negate")`',
  },
];

export const BASIC_TERMS: { term: string; definition: string; lookup: string }[] = [
  {
    term: "Champion",
    definition:
      "The unit that represents a player. It comes from the material deck and is leveled up by stacking higher-level champions on it.",
    lookup: "`card-types-champion`",
  },
  {
    term: "Lineage",
    definition:
      "The stack of cards that represents a champion. The topmost card is the current champion; elements of every champion card in the lineage are enabled.",
    lookup: "`game-terms#Lineage (term)`",
  },
  {
    term: "Level Up",
    definition: "Put the champion of the next level onto the lineage.",
    lookup: "`game-terms#Level Up`",
  },
  {
    term: "Ally",
    definition: "A unit played from the main deck. Allies can attack and retaliate.",
    lookup: "`card-types-ally`",
  },
  {
    term: "Unit",
    definition: "Champions and allies. Units can be attack targets.",
    lookup: "`game-terms#Unit`",
  },
  {
    term: "Regalia",
    definition: "A card that starts in the material deck. Every regalia has a memory cost.",
    lookup: "`card-types-supertypes#Regalia`",
  },
  {
    term: "Main Deck / Material Deck",
    definition: "The deck you draw from, and the deck that holds your champions and regalia.",
    lookup: "`game-zones-main-deck`, `game-zones-material-deck`",
  },
  {
    term: "Memory",
    definition:
      "The zone that holds cards reserved from your hand. Memory costs are paid from this zone.",
    lookup: "`game-zones-memory`",
  },
  {
    term: "Reserve cost / Memory cost",
    definition:
      "The two kinds of card costs. Main deck cards have reserve costs; material deck cards have memory costs.",
    lookup: "`parts-of-a-card-cost`",
  },
  {
    term: "Materialize",
    definition: "Put a card from the material deck into play by paying its memory cost.",
    lookup: "`playing-cards-card-materialization`",
  },
  {
    term: "Recollection",
    definition: "In the Recollection phase, return every card in your memory to your hand.",
    lookup: "`turn-order-recollection-phase`",
  },
  {
    term: "Opportunity",
    definition:
      "A chance for a player to act. It is given to the turn player first, then in turn order.",
    lookup: "`game-terms#Opportunity`",
  },
  {
    term: "Fast / Slow",
    definition:
      "The speed of cards and abilities. Slow ones can be used only in your own Main phase while the Effects Stack is empty; fast ones whenever you have Opportunity.",
    lookup: '`get_term("Fast vs Slow")`',
  },
  {
    term: "Effects Stack",
    definition: "The shared zone where card activations and abilities wait to resolve.",
    lookup: "`game-zones-effects-stack`",
  },
  {
    term: "Intent",
    definition:
      "A public zone that exists only during the Combat phase. Cards used for an attack go there.",
    lookup: "`game-zones-intent`",
  },
  {
    term: "Rest / Awake",
    definition: "Horizontal and upright orientation. Attacking and some costs rest a card.",
    lookup: "`game-terms#Rest/Rested`",
  },
  {
    term: "Damage counter / Life",
    definition:
      "Damage to a champion stays as damage counters; when they reach its life, the champion dies.",
    lookup: "`game-mechanics-counters#Damage`",
  },
  {
    term: "Banishment",
    definition: "The zone banished cards go to.",
    lookup: "`game-terms#Banish`",
  },
];

export const GAME_FLOW: string[] = [
  "Setup: Each player has a main deck and a material deck. The material deck holds champions and regalia. Before the first turn each player reveals a Lv 0 champion from the material deck and puts it onto the field, and that champion's On Enter ability draws the starting hand (`general-rules-starting-the-game#Standard Games:6`). The rules documents do not give the starting hand size; it is written on the Lv 0 champion card (most say Draw seven cards).",
  "Turn: Wake Up (wake up your rested objects, `turn-order-wake-up-phase`) → Materialize (you may materialize one champion or regalia from your material deck by paying its memory cost, `turn-order-materialize-phase`) → Recollection (return every card in your memory to your hand, `turn-order-recollection-phase`) → Draw (draw one card, `turn-order-draw-phase`) → Main (activate cards and attack; an attack starts a Combat phase, `turn-order-main-phase`) → End (damage on allies is removed, `turn-order-end-phase`, `game-mechanics-damage#General Rules:12`). On each player's first turn, Wake Up, Materialize and Recollection are skipped; in a two-player game the first player also skips Draw (`general-rules-starting-the-game#Standard Games - Turn One`).",
  "Paying: Main deck cards cost reserve and material deck cards cost memory (`parts-of-a-card-cost#Cost:7`). Cards reserved from your hand into memory return to your hand at your next Recollection.",
  "Leveling: Materializing a champion one level higher than your champion on the field, meeting its lineage requirement, levels it up (`card-types-champion#General Rules:7`).",
  "Winning: Damage dealt to a champion stays as damage counters. When the counters reach the champion's life, the champion dies and its controller loses (`game-mechanics-counters#Damage:3`, `game-mechanics-damage#General Rules:13`). Other ways to win, lose or draw are listed in `general-rules-ending-the-game`.",
];

// ルール文書は advanced element を列挙していないので、カードデータから集めて手で書く。
export const ELEMENTS: { group: string; names: string[]; note: string }[] = [
  { group: "Norm", names: ["Norm"], note: "enabled for every player" },
  { group: "Basic", names: ["Fire", "Water", "Wind"], note: "" },
  {
    group: "Advanced",
    names: ["Arcane", "Astra", "Crux", "Exia", "Luxem", "Neos", "Tera", "Umbra"],
    note: "",
  },
  {
    group: "Exalted",
    names: ["Exalted"],
    note: "a special advanced element, enabled while you have a champion that enables an advanced element (`game-mechanics-special-elements`)",
  },
];

export const ELEMENT_NOTE = `Basic and advanced elements other than Exalted are enabled by the elements of the champions in your lineage (\`parts-of-a-card-element#Element:3\`).`;
