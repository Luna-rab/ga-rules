import { expect, test } from "bun:test";
import { renderSearchRules } from "./search-rules";

test("hint だけの条文は、hint を外さずに見せる", () => {
  const out = renderSearchRules(
    [
      {
        clauseId: "p#S:0",
        pageTitle: "P",
        url: "https://rules.gatcg.com/a/p#s",
        text: "Example: Only a hint.",
      },
    ],
    [],
    new Map(),
  );
  expect(out).toContain("- [p#S:0](https://rules.gatcg.com/a/p#s) (P) Example: Only a hint.");
});

test("条文の行は - [clause_id](URL) (ページ名) 本文 の形", () => {
  const out = renderSearchRules(
    [{ clauseId: "p#S:1", pageTitle: "P", url: "https://rules.gatcg.com/a/p#s", text: "Body." }],
    [],
    new Map(),
  );
  expect(out).toContain("- [p#S:1](https://rules.gatcg.com/a/p#s) (P) Body.\n");
});

test("条文ごとに、その条文の節の URL が付く", () => {
  const out = renderSearchRules(
    [
      { clauseId: "p#S:1", pageTitle: "P", url: "https://rules.gatcg.com/a/p#s", text: "One." },
      { clauseId: "q#T:2", pageTitle: "Q", url: "https://rules.gatcg.com/b/q", text: "Two." },
    ],
    [],
    new Map(),
  );
  expect(out).toContain("- [p#S:1](https://rules.gatcg.com/a/p#s) (P) One.");
  expect(out).toContain("- [q#T:2](https://rules.gatcg.com/b/q) (Q) Two.");
});

test("条文の本文にあるページへのリンクは書き換わる", () => {
  const out = renderSearchRules(
    [
      {
        clauseId: "p#S:1",
        pageTitle: "P",
        url: "https://rules.gatcg.com/a/p#s",
        text: "Take [damage](game-mechanics-damage).",
      },
    ],
    [],
    new Map([
      ["game-mechanics-damage", "https://rules.gatcg.com/game-mechanics/game-mechanics-damage"],
    ]),
  );
  expect(out).toContain(
    "(P) Take [damage](https://rules.gatcg.com/game-mechanics/game-mechanics-damage) [game-mechanics-damage].",
  );
});
