import { describe, expect, test } from "bun:test";
import {
  cardUrl,
  gitbookAnchor,
  RULES_SITE_URL,
  rulesPageUrl,
  rulesSectionUrl,
  rulingUrl,
} from "./site-url";

describe("rulesPageUrl", () => {
  test(".md を外したパスをサイトの URL に足す", () => {
    expect(
      rulesPageUrl("game-mechanics/game-mechanics-playing-cards/playing-cards-resolution.md"),
    ).toBe(
      "https://rules.gatcg.com/game-mechanics/game-mechanics-playing-cards/playing-cards-resolution",
    );
  });

  test("README.md はディレクトリのパスになる", () => {
    expect(rulesPageUrl("general-rules/general-rules-parts-of-a-card/README.md")).toBe(
      "https://rules.gatcg.com/general-rules/general-rules-parts-of-a-card",
    );
  });

  test("直下の README.md はサイトの URL そのもの", () => {
    expect(rulesPageUrl("README.md")).toBe(RULES_SITE_URL);
  });
});

describe("rulesSectionUrl", () => {
  test("anchor があればページ URL に # で足し、null ならページ URL のまま", () => {
    expect(rulesSectionUrl("https://rules.gatcg.com/p", "general-rules")).toBe(
      "https://rules.gatcg.com/p#general-rules",
    );
    expect(rulesSectionUrl("https://rules.gatcg.com/p", null)).toBe("https://rules.gatcg.com/p");
  });
});

describe("gitbookAnchor", () => {
  test("小文字にし、記号を除き、空白をハイフンにする", () => {
    expect(gitbookAnchor("General Rules")).toBe("general-rules");
    expect(gitbookAnchor("Crowd's Favor")).toBe("crowds-favor");
  });
});

describe("cardUrl", () => {
  test("slug からカードの URL を作る", () => {
    expect(cardUrl("seiryuu-azure-dragon")).toBe(
      "https://index.gatcg.com/card/seiryuu-azure-dragon",
    );
  });
});

describe("rulingUrl", () => {
  test("cite_id の slug のカード URL を返し、cite_id として読めなければ null", () => {
    expect(rulingUrl("fabled-azurite-fatestone#ruling:2025-03-02:3")).toBe(
      "https://index.gatcg.com/card/fabled-azurite-fatestone",
    );
    expect(rulingUrl("not-a-cite")).toBeNull();
  });
});
