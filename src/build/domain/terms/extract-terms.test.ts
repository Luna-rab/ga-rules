import { describe, expect, test } from "bun:test";
import type { Page, Term } from "../model";
import { extractTerms } from ".";

// 条文は用語の抽出に使わないので、節は見出しだけを持たせる
function page(pageId: string, title: string, headings: string[]): Page {
  return {
    pageId,
    title,
    body: "",
    sections: headings.map((heading) => ({
      sectionId: `${pageId}#${heading}`,
      pageId,
      heading,
      clauses: [],
    })),
  };
}

function find(terms: Term[], name: string): Term | undefined {
  return terms.find((t) => t.name === name);
}

describe("extractTerms", () => {
  test("同じ見出し Bulwark の節が 2 ページにあると、Term は 1 つで definitions が 2 件", () => {
    const terms = extractTerms([
      page("game-mechanics-counters", "Game Mechanics - Counters", ["Bulwark", "Omen"]),
      page("keyword-abilities", "Keyword Abilities", ["Bulwark"]),
    ]);

    expect(terms.filter((t) => t.name.toLowerCase() === "bulwark")).toHaveLength(1);
    const bulwark = find(terms, "Bulwark");
    expect(bulwark?.definitions).toHaveLength(2);
    expect(bulwark?.definitions).toContainEqual({
      pageId: "game-mechanics-counters",
      sectionId: "game-mechanics-counters#Bulwark",
    });
    expect(bulwark?.definitions).toContainEqual({
      pageId: "keyword-abilities",
      sectionId: "keyword-abilities#Bulwark",
    });
  });

  test("名前の大文字小文字が違うだけの見出しも 1 つの Term にまとめる", () => {
    const terms = extractTerms([
      page("a", "A", ["Last-Known Information"]),
      page("b", "B", ["Last-known information"]),
    ]);

    const same = terms.filter((t) => t.name.toLowerCase() === "last-known information");
    expect(same).toHaveLength(1);
    expect(same[0]?.definitions).toHaveLength(2);
  });

  test("末尾の ` N` を外す: Critical N → Critical", () => {
    const terms = extractTerms([page("keyword-abilities", "Keyword Abilities", ["Critical N"])]);

    const critical = find(terms, "Critical");
    expect(critical).toBeDefined();
    expect(critical?.definitions).toEqual([
      { pageId: "keyword-abilities", sectionId: "keyword-abilities#Critical N" },
    ]);
    expect(find(terms, "Critical N")).toBeUndefined();
  });

  test("括弧の補足を外し、Lineage (term) と Lineage (Keyword) を Term 1 つ・定義 2 件にする", () => {
    const terms = extractTerms([
      page("game-terms", "Glossary - Game Terms", ["Lineage (term)"]),
      page("keyword-abilities", "Keyword Abilities", ["Lineage (Keyword)"]),
    ]);

    expect(terms.filter((t) => t.name.toLowerCase().startsWith("lineage"))).toHaveLength(1);
    const lineage = find(terms, "Lineage");
    expect(lineage?.definitions).toHaveLength(2);
    expect(lineage?.definitions).toContainEqual({
      pageId: "game-terms",
      sectionId: "game-terms#Lineage (term)",
    });
    expect(lineage?.definitions).toContainEqual({
      pageId: "keyword-abilities",
      sectionId: "keyword-abilities#Lineage (Keyword)",
    });
  });

  test("`/` で並んだ語は先頭を名前、残りを別名にする: Activate/Activating", () => {
    const terms = extractTerms([
      page("game-terms", "Glossary - Game Terms", ["Activate/Activating"]),
    ]);

    const activate = find(terms, "Activate");
    expect(activate?.aliases).toEqual(["Activating"]);
    expect(find(terms, "Activating")).toBeUndefined();
    expect(find(terms, "Activate/Activating")).toBeUndefined();
  });

  test("`/` と ` and ` で並んだ語を分ける: Died/Dies and Kills/Killed", () => {
    const terms = extractTerms([
      page("game-terms", "Glossary - Game Terms", ["Died/Dies and Kills/Killed"]),
    ]);

    const died = find(terms, "Died");
    expect(died).toBeDefined();
    expect([...(died?.aliases ?? [])].sort()).toEqual(["Dies", "Killed", "Kills"]);
    expect(died?.definitions).toEqual([
      { pageId: "game-terms", sectionId: "game-terms#Died/Dies and Kills/Killed" },
    ]);
  });

  test("見出し General Rules の節からは Term を作らない", () => {
    const terms = extractTerms([
      page("game-mechanics-damage", "Game Mechanics - Damage", ["General Rules", "Prevention"]),
    ]);

    expect(terms.some((t) => t.name.toLowerCase().includes("general rules"))).toBe(false);
    expect(
      terms.some((t) =>
        t.definitions.some((d) => d.sectionId === "game-mechanics-damage#General Rules"),
      ),
    ).toBe(false);
    expect(find(terms, "Prevention")).toBeDefined();
  });

  test("ページ題の最後の区切りから Term を作り、その定義の sectionId は null", () => {
    const terms = extractTerms([page("game-zones-intent", "Game Zones - Intent", [])]);

    const intent = find(terms, "Intent");
    expect(intent?.definitions).toEqual([{ pageId: "game-zones-intent", sectionId: null }]);
    expect(find(terms, "Game Zones - Intent")).toBeUndefined();
    expect(find(terms, "Game Zones")).toBeUndefined();
  });

  test("termId は 1 から振り、重ならない", () => {
    const terms = extractTerms([
      page("game-mechanics-counters", "Game Mechanics - Counters", ["Bulwark", "Omen"]),
      page("keyword-abilities", "Keyword Abilities", ["Bulwark", "Critical N"]),
      page("game-zones-intent", "Game Zones - Intent", []),
    ]);

    const ids = terms.map((t) => t.termId).sort((a, b) => a - b);
    expect(ids[0]).toBe(1);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
