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

// snippet が 64 語で切った抜粋の端に残るリンクの扱い。空の urls で渡し、本文だけを見る。
function bodyOf(text: string, urls: Map<string, string> = new Map()): string {
  const out = renderSearchRules(
    [{ clauseId: "p#S:1", pageTitle: "P", url: "https://rules.gatcg.com/a/p#s", text }],
    [],
    urls,
  );
  const line = out.split("\n").find((l) => l.startsWith("- [p#S:1]")) ?? "";
  return line.replace("- [p#S:1](https://rules.gatcg.com/a/p#s) (P) ", "");
}

test.each([
  [
    "頭でラベルが切れたリンクは、リンク先を落とす",
    "...term](game-terms#Lineage (term)) and more",
    "...term and more",
  ],
  [
    "尾でリンク先が切れたリンクは、文言だけにする",
    "see [Damage](game-terms#Lineage (te",
    "see Damage...",
  ],
  ["尾でリンク先が短く切れたリンクも、文言だけにする", "end [y](unk", "end y..."],
  ["尾で閉じない [ は外す", "see [Dam", "see Dam"],
  [
    "urls に無い閉じたリンクは、後ろの本文ごとそのまま残る",
    "See [the guide](guide.md) for how to pay costs and more rules",
    "See [the guide](guide.md) for how to pay costs and more rules",
  ],
  [
    "アンカーだけのリンクもそのまま残る",
    "[x](#anchor) and then pay.",
    "[x](#anchor) and then pay.",
  ],
  [
    "括弧を含む閉じたリンクもそのまま残る",
    "a [L](game-terms#Lineage (term)) b",
    "a [L](game-terms#Lineage (term)) b",
  ],
])("search_rules の抜粋: %s", (_name, text, expected) => {
  expect(bodyOf(text)).toBe(expected);
});

test("search_rules の抜粋: 書き換えたリンクは切れたリンクの処理で壊れない", () => {
  const urls = new Map([
    ["game-mechanics-damage", "https://rules.gatcg.com/m/game-mechanics-damage"],
  ]);
  expect(bodyOf("...ution](p#S). See [Damage](game-mechanics-damage) more [x](unk", urls)).toBe(
    "...ution. See [Damage](https://rules.gatcg.com/m/game-mechanics-damage) [game-mechanics-damage] more x...",
  );
});
