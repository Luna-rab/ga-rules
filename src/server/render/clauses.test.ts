import { expect, test } from "bun:test";
import { renderSections } from "./clauses";
import type { RuleUrls } from "./rule-links";

const urls: RuleUrls = new Map([
  ["game-mechanics-damage", "https://rules.gatcg.com/game-mechanics/game-mechanics-damage"],
]);

test("節の見出しに URL を 1 回付け、条文の行には付けない", () => {
  const out = renderSections(
    [
      {
        sectionId: "p#General Rules",
        heading: "General Rules",
        url: "https://rules.gatcg.com/a/p#general-rules",
        clauses: [{ clauseId: "p#General Rules:1", text: "X" }],
      },
    ],
    new Map(),
  );
  expect(out).toBe(
    "#### General Rules (https://rules.gatcg.com/a/p#general-rules)\n[p#General Rules:1] X",
  );
});

test("節は空行で区切り、どの節の見出しにもその節の URL が付く", () => {
  const out = renderSections(
    [
      {
        sectionId: "p#A",
        heading: "A",
        url: "https://rules.gatcg.com/a/p#a",
        clauses: [{ clauseId: "p#A:1", text: "one" }],
      },
      {
        sectionId: "p#Lead",
        heading: "Lead",
        url: "https://rules.gatcg.com/a/p",
        clauses: [{ clauseId: "p#Lead:1", text: "two" }],
      },
    ],
    new Map(),
  );
  expect(out).toBe(
    [
      "#### A (https://rules.gatcg.com/a/p#a)",
      "[p#A:1] one",
      "",
      "#### Lead (https://rules.gatcg.com/a/p)",
      "[p#Lead:1] two",
    ].join("\n"),
  );
});

test("条文の本文にあるページへのリンクは書き換わる", () => {
  const out = renderSections(
    [
      {
        sectionId: "p#S",
        heading: "S",
        url: "https://rules.gatcg.com/a/p#s",
        clauses: [{ clauseId: "p#S:1", text: "Take [damage](game-mechanics-damage)." }],
      },
    ],
    urls,
  );
  expect(out).toContain(
    "[p#S:1] Take [damage](https://rules.gatcg.com/game-mechanics/game-mechanics-damage) [game-mechanics-damage].",
  );
});
