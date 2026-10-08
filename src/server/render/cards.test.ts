import { expect, test } from "bun:test";
import { type CardDetail, renderCardDetail } from "./cards";

const card: CardDetail = {
  slug: "test-card",
  name: "Test Card",
  types: ["ACTION"],
  subtypes: [],
  classes: [],
  elements: [],
  cost: { type: null, value: null },
  level: null,
  power: null,
  life: null,
  durability: null,
  speed: null,
  effectRaw: null,
  frontSlug: null,
  legality: null,
  backFace: null,
  frontFace: null,
  rulings: [],
  terms: [
    {
      name: "Class Bonus",
      definitionIds: ["keywords-and-abilities#Class Bonus", "game-mechanics-damage"],
    },
  ],
  references: [],
  clauses: [
    {
      clauseId: "p#S:1",
      url: "https://rules.gatcg.com/a/p#s",
      text: "Take [damage](game-mechanics-damage).",
    },
    { clauseId: "q#Lead:1", url: "https://rules.gatcg.com/b/q", text: "Plain." },
  ],
  otherRulings: [],
};

const urls = new Map([
  ["keywords-and-abilities#Class Bonus", "https://rules.gatcg.com/glossary/keywords#class-bonus"],
  ["game-mechanics-damage", "https://rules.gatcg.com/game-mechanics/game-mechanics-damage"],
]);

test("「Rules clauses that mention this card」の条文の行は [clause_id](URL) 本文 の形で、本文のリンクは書き換わる", () => {
  const lines = renderCardDetail(card, urls).split("\n");
  expect(lines).toContain(
    "[p#S:1](https://rules.gatcg.com/a/p#s) Take [damage](https://rules.gatcg.com/game-mechanics/game-mechanics-damage) [game-mechanics-damage].",
  );
  expect(lines).toContain("[q#Lead:1](https://rules.gatcg.com/b/q) Plain.");
});

test("「Terms」の定義 ID は [id](URL) の形で並ぶ", () => {
  expect(renderCardDetail(card, urls)).toContain(
    "- Class Bonus: [keywords-and-abilities#Class Bonus](https://rules.gatcg.com/glossary/keywords#class-bonus) [game-mechanics-damage](https://rules.gatcg.com/game-mechanics/game-mechanics-damage)",
  );
});
