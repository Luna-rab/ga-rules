import { describe, expect, test } from "bun:test";
import { rewriteRuleLinks, type RuleUrls } from "./rule-links";

const SITE = "https://rules.gatcg.com";
const RESOLUTION = `${SITE}/game-mechanics/game-mechanics-playing-cards/playing-cards-resolution`;

const urls: RuleUrls = new Map([
  ["playing-cards-resolution#General Rules", `${RESOLUTION}#general-rules`],
  ["playing-cards-resolution", RESOLUTION],
  ["game-mechanics-damage", `${SITE}/game-mechanics/game-mechanics-damage`],
  ["game-terms#Lineage (term)", `${SITE}/glossary/game-terms#lineage-term`],
  ["game-terms#Suppress", `${SITE}/glossary/game-terms#suppress`],
]);

describe("rewriteRuleLinks", () => {
  test("節見出しへのリンクは [文言](URL) [target] になる", () => {
    expect(
      rewriteRuleLinks(
        "See [Resolution: General Rules #1 through 6](playing-cards-resolution#General Rules).",
        urls,
      ),
    ).toBe(
      `See [Resolution: General Rules #1 through 6](${RESOLUTION}#general-rules) [playing-cards-resolution#General Rules].`,
    );
  });

  test("ページ全体へのリンクは、ページの URL になる", () => {
    expect(rewriteRuleLinks("deals [Damage](game-mechanics-damage) to it", urls)).toBe(
      `deals [Damage](${SITE}/game-mechanics/game-mechanics-damage) [game-mechanics-damage] to it`,
    );
  });

  test("括弧を含む節見出しへのリンクは、target 全体で引く", () => {
    expect(rewriteRuleLinks("(see [Lineage](game-terms#Lineage (term))); next", urls)).toBe(
      `(see [Lineage](${SITE}/glossary/game-terms#lineage-term) [game-terms#Lineage (term)]); next`,
    );
  });

  test("urls に無い target はそのまま残る", () => {
    for (const text of [
      "[site](https://example.com)",
      "[x](no-such-page)",
      "[x](no-such-page#Heading (a))",
    ]) {
      expect(rewriteRuleLinks(text, urls)).toBe(text);
    }
  });

  test("1 つの本文に複数のリンクがあれば、すべて書き換え、間の文字は変えない", () => {
    const text = [
      "- [Damage](game-mechanics-damage)",
      "- [site](https://example.com)",
      "- [suppressed](game-terms#Suppress) and [again](game-mechanics-damage)",
    ].join("\n");
    expect(rewriteRuleLinks(text, urls)).toBe(
      [
        `- [Damage](${SITE}/game-mechanics/game-mechanics-damage) [game-mechanics-damage]`,
        "- [site](https://example.com)",
        `- [suppressed](${SITE}/glossary/game-terms#suppress) [game-terms#Suppress] and [again](${SITE}/game-mechanics/game-mechanics-damage) [game-mechanics-damage]`,
      ].join("\n"),
    );
  });

  test("リンクの無い本文はそのまま返す", () => {
    const text = "Example: [CARDNAME] deals 3 damage.\nException: none.";
    expect(rewriteRuleLinks(text, urls)).toBe(text);
    expect(rewriteRuleLinks("", urls)).toBe("");
  });
});
