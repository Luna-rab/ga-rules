import { describe, expect, test } from "bun:test";
import type { Correction } from "../corrections";
import { DataError } from "../errors";
import type { Clause, Page, RawPage } from "../model";
import { parseRules } from "./index";

function clauses(pages: Page[]): Clause[] {
  return pages.flatMap((p) => p.sections.flatMap((s) => s.clauses));
}

function clause(pages: Page[], clauseId: string): Clause {
  const found = clauses(pages).find((c) => c.clauseId === clauseId);
  if (!found) {
    const ids = clauses(pages).map((c) => c.clauseId);
    throw new Error(`条文 ${clauseId} が無い。あるのは ${JSON.stringify(ids)}`);
  }
  return found;
}

function page(pages: Page[], pageId: string): Page {
  const found = pages.find((p) => p.pageId === pageId);
  if (!found) throw new Error(`ページ ${pageId} が無い`);
  return found;
}

function thrown(fn: () => unknown): DataError {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DataError);
    return e as DataError;
  }
  throw new Error("DataError が投げられなかった");
}

const parse = (raw: RawPage[], corrections: readonly Correction[] = []) =>
  parseRules(raw, corrections);

describe("parseRules: ページ・節・条文と hint", () => {
  const damage: RawPage = {
    path: "game-mechanics/game-mechanics-damage.md",
    markdown:
      '# Game Mechanics - Damage\n\n#### General Rules:\n\n13. Damage is marked.\n\n{% hint style="warning" %}\nChampions with Immortality will not die.\n{% endhint %}\n\n14. Next.',
  };

  test("warning の hint は「例外: 」を付けて直前の条文 13 に入り、14 には入らない", () => {
    const pages = parse([damage]);
    const c13 = clause(pages, "game-mechanics-damage#General Rules:13");
    expect(c13.number).toBe("13");
    expect(c13.sectionId).toBe("game-mechanics-damage#General Rules");
    expect(c13.text).toContain("Damage is marked.");
    expect(c13.text).toContain("例外: Champions with Immortality will not die.");
    const c14 = clause(pages, "game-mechanics-damage#General Rules:14");
    expect(c14.text).toContain("Next.");
    expect(c14.text).not.toContain("Immortality");
  });

  test("ページ ID・題・節の形", () => {
    const pages = parse([damage]);
    expect(pages).toHaveLength(1);
    const p = page(pages, "game-mechanics-damage");
    expect(p.title).toBe("Game Mechanics - Damage");
    expect(p.sections).toHaveLength(1);
    expect(p.sections[0]).toMatchObject({
      sectionId: "game-mechanics-damage#General Rules",
      pageId: "game-mechanics-damage",
      heading: "General Rules",
    });
  });

  const withHint = (attrs: string) => ({
    path: "p.md",
    markdown: `# P\n\n#### General Rules\n\n1. Rule one.\n\n{% hint ${attrs} %}\nHinted text.\n{% endhint %}\n\n2. Rule two.\n`,
  });

  test.each([
    ['style="danger"', "例外: Hinted text."],
    ['style="info"', "例: Hinted text."],
    ['style="success"', "例: Hinted text."],
    ['style="success" icon="book-sparkles"', "例: Hinted text."],
  ])("hint %s は直前の条文に「%s」として入る", (attrs, expected) => {
    const pages = parse([withHint(attrs)]);
    const c1 = clause(pages, "p#General Rules:1");
    expect(c1.text).toContain("Rule one.");
    expect(c1.text).toContain(expected);
    expect(clause(pages, "p#General Rules:2").text).not.toContain("Hinted text.");
  });

  test("info・success の hint には「例外: 」が付かない", () => {
    for (const attrs of ['style="info"', 'style="success" icon="book-sparkles"']) {
      const c1 = clause(parse([withHint(attrs)]), "p#General Rules:1");
      expect(c1.text).not.toContain("例外: ");
    }
  });

  test("直前に条文の無い hint は番号 0 の条文に入る", () => {
    const pages = parse([
      {
        path: "p.md",
        markdown:
          '# P\n\n#### Sec\n\n{% hint style="info" %}\nLead hint.\n{% endhint %}\n\n1. First.\n',
      },
    ]);
    const c0 = clause(pages, "p#Sec:0");
    expect(c0.number).toBe("0");
    expect(c0.text).toContain("例: Lead hint.");
    expect(clause(pages, "p#Sec:1").text).not.toContain("Lead hint.");
  });
});

describe("parseRules: 入れ子の番号", () => {
  test("インデントの深さで 10・10.a・10.a.i になり、同じ深さの 2 番目は 10.b", () => {
    const pages = parse([
      {
        path: "p.md",
        markdown: "# P\n\n#### Sec\n\n10. A\n   1. B\n      1. C\n      2. C2\n   2. B2\n11. D\n",
      },
    ]);
    expect(clauses(pages).map((c) => c.number)).toEqual(
      expect.arrayContaining(["10", "10.a", "10.a.i", "10.a.ii", "10.b", "11"]),
    );
    expect(clause(pages, "p#Sec:10.a").text).toContain("B");
    expect(clause(pages, "p#Sec:10.a.i").text).toContain("C");
    expect(clause(pages, "p#Sec:10.a.ii").text).toContain("C2");
    expect(clause(pages, "p#Sec:10.b").text).toContain("B2");
    expect(clause(pages, "p#Sec:11").text).toContain("D");
  });

  test("ちょうど 3 条文になる", () => {
    const pages = parse([
      { path: "p.md", markdown: "# P\n\n#### Sec\n\n10. A\n   1. B\n      1. C\n" },
    ]);
    expect(clauses(pages).map((c) => c.number)).toEqual(["10", "10.a", "10.a.i"]);
  });

  test("節が変わると番号は 1 から振り直され、重なりにならない", () => {
    const pages = parse([
      { path: "p.md", markdown: "# P\n\n#### First\n\n1. A\n2. B\n\n#### Second\n\n1. C\n" },
    ]);
    expect(clause(pages, "p#First:1").text).toContain("A");
    expect(clause(pages, "p#First:2").text).toContain("B");
    expect(clause(pages, "p#Second:1").text).toContain("C");
    expect(clause(pages, "p#Second:1").sectionId).toBe("p#Second");
  });
});

describe("parseRules: 消すもの", () => {
  const noisy: RawPage = {
    path: "dir/noisy.md",
    markdown:
      '---\ndescription: Front matter text\nlayout: wide\n---\n\n# Noisy Page\n\n#### Sec&#x20;\n\n1. Alpha <img src="https://x/y.png" alt="pic"> beta ![](../.gitbook/assets/z.png) gamma&#x20;\n',
  };

  test("YAML 前置き・<img>・Markdown 画像・&#x20; は条文の text と Page.body に残らない", () => {
    const pages = parse([noisy]);
    const p = page(pages, "noisy");
    expect(p.title).toBe("Noisy Page");
    const c1 = clause(pages, "noisy#Sec:1");
    for (const text of [p.body, c1.text]) {
      expect(text).not.toContain("Front matter text");
      expect(text).not.toContain("layout: wide");
      expect(text).not.toContain("<img");
      expect(text).not.toContain("![](");
      expect(text).not.toContain("&#x20;");
    }
    expect(c1.text).toContain("Alpha");
    expect(c1.text).toContain("beta");
    expect(c1.text).toContain("gamma");
    expect(p.body).toContain("Alpha");
  });

  test("画像だけの見出しは節にならず、その下の条文は直前の節に入る", () => {
    const pages = parse([
      { path: "p.md", markdown: "# P\n\n#### Sec\n\n1. X\n\n#### ![](x.png)\n\n2. Y\n" },
    ]);
    const p = page(pages, "p");
    expect(p.sections.map((s) => s.heading)).toEqual(["Sec"]);
    expect(clause(pages, "p#Sec:2").text).toContain("Y");
    expect(clause(pages, "p#Sec:2").sectionId).toBe("p#Sec");
  });

  test("画像だけの見出しの下の 1 が直前の節の 1 と重なると DataError", () => {
    thrown(() =>
      parse([{ path: "p.md", markdown: "# P\n\n#### Sec\n\n1. X\n\n#### ![](x.png)\n\n1. Y\n" }]),
    );
  });
});

describe("parseRules: 節の分け方", () => {
  test("最初の #### より前の本文は、ページ題の最後の区切りを見出しとする節に入る", () => {
    const pages = parse([
      {
        path: "general-rules/objectives.md",
        markdown:
          "# General Rules - Objectives\n\n1. Win the game.\n\n#### General Rules\n\n1. Other.\n",
      },
    ]);
    const c = clause(pages, "objectives#Objectives:1");
    expect(c.text).toContain("Win the game.");
    expect(clause(pages, "objectives#General Rules:1").text).toContain("Other.");
  });

  test("README.md のページ ID は親ディレクトリ名", () => {
    const pages = parse([
      { path: "glossary/README.md", markdown: "# Glossary\n\n#### Sec\n\n1. A\n" },
    ]);
    expect(pages.map((p) => p.pageId)).toEqual(["glossary"]);
  });
});

describe("parseRules: リンク", () => {
  const glossary: RawPage = {
    path: "glossary/game-terms.md",
    markdown:
      '# Glossary - Game Terms\n\n#### Died/Dies <a href="#dies" id="dies"></a>\n\n1. Destroyed.\n\n#### Negated&#x20;\n\n1. Nothing happens.\n\n#### Nullified\n\n1. Gone.\n',
  };

  test("<a> を埋め込んだ見出しは heading から外れ、id のアンカーへのリンクはその節に解決される", () => {
    const pages = parse([
      glossary,
      {
        path: "game-mechanics/x.md",
        markdown:
          "# X\n\n#### General Rules:\n\n1. When it [d](../glossary/game-terms.md#dies) here.\n",
      },
    ]);
    expect(page(pages, "game-terms").sections.map((s) => s.heading)).toContain("Died/Dies");
    const c = clause(pages, "x#General Rules:1");
    expect(c.text).toContain("[d](game-terms#Died/Dies)");
    expect(c.text).not.toContain("../glossary");
    expect(c.links).toEqual([{ pageId: "game-terms", sectionId: "game-terms#Died/Dies" }]);
  });

  const targets: RawPage[] = [
    { path: "a/b.md", markdown: "# B\n\n#### Inner Lineage\n\n1. Lineage.\n" },
    { path: "dir/README.md", markdown: "# Dir\n\n#### Sec\n\n1. Dir.\n" },
    { path: "c/README.md", markdown: "# C\n\n#### Sec\n\n1. C.\n" },
  ];

  test("GitBook のアンカーは見出しに、ディレクトリと ./ は README.md のページに解決される", () => {
    const pages = parse([
      ...targets,
      {
        path: "c/p.md",
        markdown:
          "# P\n\n#### Sec\n\n1. See [x](../a/b.md#inner-lineage).\n2. See [y](../dir/).\n3. See [z](./).\n",
      },
    ]);
    const c1 = clause(pages, "p#Sec:1");
    expect(c1.text).toContain("[x](b#Inner Lineage)");
    expect(c1.links).toEqual([{ pageId: "b", sectionId: "b#Inner Lineage" }]);
    const c2 = clause(pages, "p#Sec:2");
    expect(c2.text).toContain("[y](dir)");
    expect(c2.links).toEqual([{ pageId: "dir", sectionId: null }]);
    const c3 = clause(pages, "p#Sec:3");
    expect(c3.text).toContain("[z](c)");
    expect(c3.links).toEqual([{ pageId: "c", sectionId: null }]);
  });

  test("http(s) のリンクはそのまま残り links に入らない。.gitbook/assets/ へのリンクは捨てる", () => {
    const pages = parse([
      {
        path: "c/p.md",
        markdown:
          "# P\n\n#### Sec\n\n1. Web [x](https://example.com) and [chart](../.gitbook/assets/chart.pdf) end.\n",
      },
    ]);
    const c1 = clause(pages, "p#Sec:1");
    expect(c1.text).toContain("[x](https://example.com)");
    expect(c1.text).not.toContain(".gitbook/assets");
    expect(c1.links).toEqual([]);
  });

  test("リンク先のページが無いと、ファイルパスとリンク先を添えて DataError", () => {
    const e = thrown(() =>
      parse([
        ...targets,
        { path: "c/p.md", markdown: "# P\n\n#### Sec\n\n1. See [x](../nope.md).\n" },
      ]),
    );
    expect(e.message).toContain("c/p.md");
    expect(e.message).toContain("../nope.md");
  });

  test("リンク先の節が無いと、ファイルパスとリンク先を添えて DataError", () => {
    const e = thrown(() =>
      parse([
        ...targets,
        { path: "c/p.md", markdown: "# P\n\n#### Sec\n\n1. See [x](../a/b.md#missing).\n" },
      ]),
    );
    expect(e.message).toContain("c/p.md");
    expect(e.message).toContain("../a/b.md#missing");
  });

  describe("rule-link の修正", () => {
    const negatedPage: RawPage = {
      ...glossary,
      markdown: `${glossary.markdown}\n#### Other\n\n1. See [negated](game-terms.md#negated).\n`,
    };

    test("to のとおりに書き換わり links に入る", () => {
      const fix: Correction = {
        kind: "rule-link",
        path: "glossary/game-terms.md",
        from: "game-terms.md#negated",
        to: { pageId: "game-terms", sectionId: "game-terms#Negated" },
        reason: "テスト",
      };
      const c = clause(parse([negatedPage], [fix]), "game-terms#Other:1");
      expect(c.text).toContain("[negated](game-terms#Negated)");
      expect(c.links).toEqual([{ pageId: "game-terms", sectionId: "game-terms#Negated" }]);
    });

    test("修正はリンクの解決より先に当たる（解決できるリンクでも to が勝つ）", () => {
      const fix: Correction = {
        kind: "rule-link",
        path: "glossary/game-terms.md",
        from: "game-terms.md#negated",
        to: { pageId: "game-terms", sectionId: "game-terms#Nullified" },
        reason: "テスト",
      };
      const c = clause(parse([negatedPage], [fix]), "game-terms#Other:1");
      expect(c.text).toContain("[negated](game-terms#Nullified)");
      expect(c.links).toEqual([{ pageId: "game-terms", sectionId: "game-terms#Nullified" }]);
    });

    test("to が null ならリンクを外して文字だけ残し、links に入らない", () => {
      const from = "../../../glossary/game-terms.md#have-gain-get-become-are";
      const pages = parse(
        [
          glossary,
          {
            path: "a/b/c/README.md",
            markdown: `# C\n\n#### Sec\n\n1. See [here](${from}) now.\n`,
          },
        ],
        [{ kind: "rule-link", path: "a/b/c/README.md", from, to: null, reason: "節が無い" }],
      );
      const c = clause(pages, "c#Sec:1");
      expect(c.text).toContain("See here now.");
      expect(c.text).not.toContain("[here]");
      expect(c.text).not.toContain("have-gain");
      expect(c.links).toEqual([]);
    });

    test("どのリンクにも当たらない項目は、その from を添えて DataError", () => {
      const e = thrown(() =>
        parse(
          [glossary],
          [
            {
              kind: "rule-link",
              path: "glossary/game-terms.md",
              from: "game-terms.md#gone-away",
              to: null,
              reason: "テスト",
            },
          ],
        ),
      );
      expect(e.message).toContain("game-terms.md#gone-away");
    });

    test("from が同じでも path の違うページのリンクには当たらず DataError", () => {
      const e = thrown(() =>
        parse(
          [negatedPage],
          [
            {
              kind: "rule-link",
              path: "glossary/other.md",
              from: "game-terms.md#negated",
              to: null,
              reason: "テスト",
            },
          ],
        ),
      );
      expect(e.message).toContain("game-terms.md#negated");
    });

    test("card-reference の項目は parseRules では使わず、当たらなくても DataError にしない", () => {
      const pages = parse(
        [glossary],
        [
          {
            kind: "card-reference",
            cardSlug: "x",
            from: "y",
            to: "z",
            reason: "テスト",
          },
        ],
      );
      expect(page(pages, "game-terms").sections.length).toBe(3);
    });
  });
});
