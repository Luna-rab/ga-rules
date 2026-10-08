import { describe, expect, test } from "bun:test";
import type { Clause, Page, SectionKind, Term } from "../model";
import { DataError } from "../errors";
import { assertTermSources, extractTerms, Matcher } from ".";

// 条文は用語の抽出に使わないので、節は見出しと種類だけを持たせる。
// 文字列だけ渡した節は #### の見出し（kind "heading"）
function page(pageId: string, title: string, headings: (string | [string, SectionKind])[]): Page {
  return {
    pageId,
    title,
    url: `https://rules.gatcg.com/${pageId}`,
    sections: headings.map((h) => {
      const [heading, kind] = typeof h === "string" ? [h, "heading" as const] : h;
      return {
        sectionId: `${pageId}#${heading}`,
        pageId,
        heading,
        kind,
        url: `https://rules.gatcg.com/${pageId}`,
        clauses: [],
      };
    }),
  };
}

function clause(sectionId: string, number: string, text: string): Clause {
  return { clauseId: `${sectionId}:${number}`, sectionId, number, text, links: [] };
}

function find(terms: Term[], name: string): Term | undefined {
  return terms.find((t) => t.name === name);
}

describe("extractTerms", () => {
  test("同じ見出し Bulwark の節が 2 ページにあると、Term は 1 つで definitions が 2 件", () => {
    const terms = extractTerms([
      page("game-mechanics-counters", "Game Mechanics - Counters", [
        ["Bulwark", "heading"],
        ["Omen", "heading"],
      ]),
      page("keyword-abilities", "Keyword Abilities", [["Bulwark", "heading"]]),
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

  test("末尾の ` N+` も外す: Memory N+ → Memory で、Memory 4+ の文に当たる", () => {
    const terms = extractTerms([
      page("keywords-and-abilities", "Keywords and Abilities", ["Memory N+"]),
    ]);

    const memory = find(terms, "Memory");
    expect(memory?.definitions).toEqual([
      { pageId: "keywords-and-abilities", sectionId: "keywords-and-abilities#Memory N+" },
    ]);
    expect(find(terms, "Memory N+")).toBeUndefined();

    const matcher = new Matcher(terms.map((t) => ({ key: t.name, names: [t.name, ...t.aliases] })));
    expect(matcher.match("Memory 4+ — draw a card.")).toEqual(["Memory"]);
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
    expect((died?.aliases ?? []).toSorted((a, b) => a.localeCompare(b))).toEqual([
      "Dies",
      "Killed",
      "Kills",
    ]);
    expect(died?.definitions).toEqual([
      { pageId: "game-terms", sectionId: "game-terms#Died/Dies and Kills/Killed" },
    ]);
  });

  test("カンマで並んだ見出しは分けず、末尾にカンマの残る名前を作らない", () => {
    const heading = "Copying Abilities, Card Activations, and Materializations";
    const terms = extractTerms([page("game-terms", "Glossary - Game Terms", [heading])]);

    const copying = find(terms, heading);
    expect(copying?.aliases).toEqual([]);
    expect(copying?.definitions).toEqual([
      { pageId: "game-terms", sectionId: `game-terms#${heading}` },
    ]);
    expect(terms.some((t) => [t.name, ...t.aliases].some((n) => n.endsWith(",")))).toBe(false);
    expect(find(terms, "Copying Abilities")).toBeUndefined();
  });

  test("`/` を含まない ` and ` の見出しは分けず、見出しのまま名前にする", () => {
    const terms = extractTerms([
      page("game-concepts", "Game Concepts", [
        "Control and Ownership",
        "Properties and States of Objects",
      ]),
    ]);

    const control = find(terms, "Control and Ownership");
    expect(control?.aliases).toEqual([]);
    expect(control?.definitions).toEqual([
      { pageId: "game-concepts", sectionId: "game-concepts#Control and Ownership" },
    ]);
    const properties = find(terms, "Properties and States of Objects");
    expect(properties?.aliases).toEqual([]);
    expect(find(terms, "Control")).toBeUndefined();
    expect(find(terms, "Ownership")).toBeUndefined();
    expect(find(terms, "Properties")).toBeUndefined();
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

  test("ページ題の最後の区切りと同じ名前の節があると、節の定義と sectionId null の定義の 2 件になる", () => {
    const terms = extractTerms([
      page("game-zones-intent", "Game Zones - Intent", [
        ["Intent", "heading"],
        ["Declaring Intent", "heading"],
      ]),
    ]);

    expect(terms.filter((t) => t.name.toLowerCase() === "intent")).toHaveLength(1);
    const intent = find(terms, "Intent");
    expect(intent?.definitions).toHaveLength(2);
    expect(intent?.definitions).toContainEqual({
      pageId: "game-zones-intent",
      sectionId: "game-zones-intent#Intent",
    });
    expect(intent?.definitions).toContainEqual({ pageId: "game-zones-intent", sectionId: null });
  });

  test("lead の節と、minor の節のうち番号付きの手順と末尾が `:` の前置きからは作らない", () => {
    const terms = extractTerms([
      page("game-zones-intent", "Game Zones - Intent", [
        ["Intent", "lead"],
        ["Declaring Intent", "heading"],
        ["Leveling Up", "minor"],
        ["1.1 Announcing Activation", "minor"],
        ["Masteries:", "minor"],
      ]),
    ]);

    expect(terms.map((t) => t.name).toSorted()).toEqual([
      "Declaring Intent",
      "Intent",
      "Leveling Up",
    ]);
    expect(find(terms, "Intent")?.definitions).toEqual([
      { pageId: "game-zones-intent", sectionId: null },
    ]);
    expect(find(terms, "Declaring Intent")?.definitions).toEqual([
      { pageId: "game-zones-intent", sectionId: "game-zones-intent#Declaring Intent" },
    ]);
  });

  test("書き方の違う見出しを 1 つの Term にまとめる: X Counters と X、単数と複数", () => {
    const terms = extractTerms([
      page("game-mechanics-counters", "Game Mechanics - Counters", ["Buff"]),
      page("game-terms", "Glossary - Game Terms", ["Buff Counters", "Token"]),
      page("game-mechanics-tokens", "Game Mechanics - Tokens", []),
    ]);

    expect(find(terms, "Buff")?.aliases).toEqual(["Buff Counters"]);
    expect(find(terms, "Buff")?.definitions).toEqual([
      { pageId: "game-mechanics-counters", sectionId: "game-mechanics-counters#Buff" },
      { pageId: "game-terms", sectionId: "game-terms#Buff Counters" },
    ]);
    expect(find(terms, "Token")?.aliases).toEqual(["Tokens"]);
    expect(find(terms, "Token")?.definitions).toEqual([
      { pageId: "game-terms", sectionId: "game-terms#Token" },
      { pageId: "game-mechanics-tokens", sectionId: null },
    ]);
  });

  test("Label Keywords の箇条書きと、小見出しの役をする条文から Term を作る", () => {
    const labels = "game-terms#Label Keywords";
    const weapons = "card-types-functional-subtypes#Functional Weapons";
    const terms = extractTerms([
      {
        pageId: "game-terms",
        title: "Glossary - Game Terms",
        url: "https://rules.gatcg.com/game-terms",
        sections: [
          {
            sectionId: labels,
            pageId: "game-terms",
            heading: "Label Keywords",
            kind: "heading",
            url: "https://rules.gatcg.com/game-terms#label-keywords",
            clauses: [
              clause(labels, "3", "List of Label keywords:\n- Balance: ...\n- Deluge N: ..."),
            ],
          },
        ],
      },
      {
        pageId: "card-types-functional-subtypes",
        title: "Card Types - Functional Subtypes",
        url: "https://rules.gatcg.com/card-types-functional-subtypes",
        sections: [
          {
            sectionId: weapons,
            pageId: "card-types-functional-subtypes",
            heading: "Functional Weapons",
            kind: "heading",
            url: "https://rules.gatcg.com/card-types-functional-subtypes#functional-weapons",
            clauses: [
              clause(weapons, "1", "Gun / Bow"),
              clause(weapons, "1.a", "Gun and Bow are functional weapon subtypes."),
              clause(weapons, "2", "No sub-clauses"),
            ],
          },
        ],
      },
    ]);

    for (const name of ["Balance", "Deluge"]) {
      expect(find(terms, name)?.definitions).toEqual([{ pageId: "game-terms", sectionId: labels }]);
    }
    for (const name of ["Gun", "Bow"]) {
      expect(find(terms, name)?.definitions).toEqual([
        { pageId: "card-types-functional-subtypes", sectionId: weapons },
      ]);
    }
    expect(find(terms, "No sub-clauses")).toBeUndefined();
  });

  test("assertTermSources: Label Keywords の節が無いと DataError", () => {
    const pages = [page("game-terms", "Glossary - Game Terms", ["Destruction"])];
    expect(() => assertTermSources(pages, extractTerms(pages))).toThrow(DataError);
  });

  test("termId は 1 から振り、重ならない", () => {
    const terms = extractTerms([
      page("game-mechanics-counters", "Game Mechanics - Counters", ["Bulwark", "Omen"]),
      page("keyword-abilities", "Keyword Abilities", ["Bulwark", "Critical N"]),
      page("game-zones-intent", "Game Zones - Intent", []),
    ]);

    const ids = terms.map((t) => t.termId).toSorted((a, b) => a - b);
    expect(ids[0]).toBe(1);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
