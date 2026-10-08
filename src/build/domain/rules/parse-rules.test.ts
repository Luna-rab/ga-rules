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
    if (!(e instanceof DataError)) throw e;
    return e;
  }
  throw new Error("DataError が投げられなかった");
}

const parse = (raw: RawPage[], corrections: readonly Correction[] = []) =>
  parseRules(raw, corrections);

const withHint = (attrs: string): RawPage => ({
  path: "p.md",
  markdown: `# P\n\n#### General Rules\n\n1. Rule one.\n\n{% hint ${attrs} %}\nHinted text.\n{% endhint %}\n\n2. Rule two.\n`,
});

describe("parseRules: ページ・節・条文と hint", () => {
  const damage: RawPage = {
    path: "game-mechanics/game-mechanics-damage.md",
    markdown:
      '# Game Mechanics - Damage\n\n#### General Rules:\n\n13. Damage is marked.\n\n{% hint style="warning" %}\nChampions with Immortality will not die.\n{% endhint %}\n\n14. Next.',
  };

  test("warning の hint は「Exception:」を付けて直前の条文 13 に入り、14 には入らない", () => {
    const pages = parse([damage]);
    const c13 = clause(pages, "game-mechanics-damage#General Rules:13");
    expect(c13.number).toBe("13");
    expect(c13.sectionId).toBe("game-mechanics-damage#General Rules");
    expect(c13.text).toContain("Damage is marked.");
    expect(c13.text).toContain("Exception: Champions with Immortality will not die.");
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
      kind: "heading",
    });
  });

  test.each([
    ['style="danger"', "Exception: Hinted text."],
    ['style="info"', "Example: Hinted text."],
    ['style="success"', "Example: Hinted text."],
    ['style="success" icon="book-sparkles"', "Example: Hinted text."],
  ])("hint %s は直前の条文に「%s」として入る", (attrs, expected) => {
    const pages = parse([withHint(attrs)]);
    const c1 = clause(pages, "p#General Rules:1");
    expect(c1.text).toContain("Rule one.");
    expect(c1.text).toContain(expected);
    expect(clause(pages, "p#General Rules:2").text).not.toContain("Hinted text.");
  });

  test("info・success の hint には「Exception:」が付かない", () => {
    for (const attrs of ['style="info"', 'style="success" icon="book-sparkles"']) {
      const c1 = clause(parse([withHint(attrs)]), "p#General Rules:1");
      expect(c1.text).not.toContain("Exception:");
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
    expect(c0.text).toContain("Example: Lead hint.");
    expect(clause(pages, "p#Sec:1").text).not.toContain("Lead hint.");
  });

  test("hint だけを挟んで 1 から書き直された番号は続き番号になる", () => {
    const pages = parse([
      {
        path: "p.md",
        markdown:
          '# P - Q\n\n#### General Rules\n\n1. A\n\n{% hint style="info" %}\nX\n{% endhint %}\n\n1. B',
      },
    ]);
    const c1 = clause(pages, "p#General Rules:1");
    expect(c1.number).toBe("1");
    expect(c1.text).toContain("A");
    expect(c1.text).toContain("Example: X");
    const c2 = clause(pages, "p#General Rules:2");
    expect(c2.number).toBe("2");
    expect(c2.text).toContain("B");
    expect(c2.text).not.toContain("X");
    expect(clauses(pages)).toHaveLength(2);
  });

  test("{% endhint %} の無い hint は、ファイルパスを添えて DataError", () => {
    const e = thrown(() =>
      parse([
        {
          path: "dir/unclosed.md",
          markdown: '# P\n\n#### Sec\n\n1. A\n\n{% hint style="info" %}\nNever closed.\n\n2. B\n',
        },
      ]),
    );
    expect(e.message).toContain("dir/unclosed.md");
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

  test("General Rules の節で clauseId が 10・10.a・10.a.i の 3 条文になる", () => {
    const pages = parse([
      { path: "p.md", markdown: "# P - Q\n\n#### General Rules\n\n10. A\n   1. B\n      1. C" },
    ]);
    expect(clauses(pages).map((c) => [c.clauseId, c.number])).toEqual([
      ["p#General Rules:10", "10"],
      ["p#General Rules:10.a", "10.a"],
      ["p#General Rules:10.a.i", "10.a.i"],
    ]);
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

  test("YAML 前置き・<img>・Markdown 画像・&#x20; は条文の text に残らない", () => {
    const pages = parse([noisy]);
    const p = page(pages, "noisy");
    expect(p.title).toBe("Noisy Page");
    const c1 = clause(pages, "noisy#Sec:1");
    expect(c1.text).not.toContain("Front matter text");
    expect(c1.text).not.toContain("layout: wide");
    expect(c1.text).not.toContain("<img");
    expect(c1.text).not.toContain("![](");
    expect(c1.text).not.toContain("&#x20;");
    expect(c1.text).toContain("Alpha");
    expect(c1.text).toContain("beta");
    expect(c1.text).toContain("gamma");
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

  test("節の種類: 見出しより前の本文は lead、#### は heading、### と行頭の太字は minor", () => {
    const pages = parse([
      {
        path: "playing-cards/playing-cards-card-activation.md",
        markdown:
          "# Playing Cards - Card Activation\n\nIntro.\n\n#### General Rules\n\n1. A\n\n### Standard Games\n\n1. B\n\n**1.1 Announcing Activation**: First.\n\n1. C",
      },
    ]);
    const p = page(pages, "playing-cards-card-activation");
    expect(p.sections.map((s) => [s.heading, s.kind])).toEqual([
      ["Card Activation", "lead"],
      ["General Rules", "heading"],
      ["Standard Games", "minor"],
      ["1.1 Announcing Activation", "minor"],
    ]);
  });

  test("節の種類: 行頭の太字だけの行は minor、#### は heading。条文の無い ### は節にならない", () => {
    const p = page(
      parse([
        {
          path: "x.md",
          markdown: "# M - X\n\n**Leveling Up**\n\n1. A\n\n### Masteries:\n\n#### Next\n\n1. B",
        },
      ]),
      "x",
    );
    expect(p.sections.map((s) => [s.heading, s.kind])).toEqual([
      ["Leveling Up", "minor"],
      ["Next", "heading"],
    ]);
  });

  test("README.md のページ ID は親ディレクトリ名", () => {
    const pages = parse([
      { path: "glossary/README.md", markdown: "# Glossary\n\n#### Sec\n\n1. A\n" },
    ]);
    expect(pages.map((p) => p.pageId)).toEqual(["glossary"]);
  });

  describe("####・###・行頭の太字で節を区切る", () => {
    const mixed: RawPage = {
      path: "game-mechanics/x.md",
      markdown:
        "# M - X\n\n#### General Rules\n\n1. A\n\n### Standard Games\n\n1. B\n\n**Leveling Up**\n\n1. C\n\n**1.1 Announcing Activation**: First, announce.\n\n1. D\n\n**1.4 Selecting Modes:** Pick.\n\n### Masteries:\n\n#### Next\n\n1. E",
    };

    test("6 節に分かれ、見出しは区切りの文字列から末尾の : を落としたもの", () => {
      const p = page(parse([mixed]), "x");
      expect(p.sections.map((s) => s.heading)).toEqual([
        "General Rules",
        "Standard Games",
        "Leveling Up",
        "1.1 Announcing Activation",
        "1.4 Selecting Modes",
        "Next",
      ]);
    });

    test("どの節でも番号は 1 から振り直され、各条文がその節に入る", () => {
      const pages = parse([mixed]);
      expect(clause(pages, "x#General Rules:1").text).toContain("A");
      expect(clause(pages, "x#Standard Games:1").text).toContain("B");
      expect(clause(pages, "x#Standard Games:1").sectionId).toBe("x#Standard Games");
      expect(clause(pages, "x#Leveling Up:1").text).toContain("C");
      expect(clause(pages, "x#1.1 Announcing Activation:1").text).toContain("D");
      expect(clause(pages, "x#Next:1").text).toContain("E");
    });

    test("太字の後ろに続く文は、頭の : と空白を落としてその節の番号 0 の条文になる", () => {
      const pages = parse([mixed]);
      const a0 = clause(pages, "x#1.1 Announcing Activation:0");
      expect(a0.number).toBe("0");
      expect(a0.text).toBe("First, announce.");
      expect(clause(pages, "x#1.4 Selecting Modes:0").text).toBe("Pick.");
      expect(clause(pages, "x#1.1 Announcing Activation:1").text).not.toContain("First");
    });

    test("直後に #### が来る ### の節は、条文が無いので出さない", () => {
      const p = page(parse([mixed]), "x");
      expect(p.sections.find((s) => s.heading === "Masteries")).toBeUndefined();
    });
  });

  test("番号の無い段落と箇条書きは、直前の条文の text に行を分けて続き、箇条書きは「- 」に揃える", () => {
    const pages = parse([
      {
        path: "p.md",
        markdown: "# P - Q\n\n#### General Rules\n\n1. A\n\nSituations:\n\n* x\n* y",
      },
    ]);
    expect(clause(pages, "p#General Rules:1").text).toBe("A\nSituations:\n- x\n- y");
    expect(clauses(pages)).toHaveLength(1);
  });

  test("節の頭にある番号の無い段落は、番号 0 の条文になる", () => {
    const pages = parse([
      { path: "p.md", markdown: "# P - Q\n\n#### General Rules\n\nLead.\n\n1. A" },
    ]);
    const c0 = clause(pages, "p#General Rules:0");
    expect(c0.number).toBe("0");
    expect(c0.text).toContain("Lead.");
    expect(clause(pages, "p#General Rules:1").text).not.toContain("Lead.");
  });

  test("# で始まる行の無いページは、ファイルパスを添えて DataError", () => {
    const e = thrown(() =>
      parse([{ path: "dir/untitled.md", markdown: "#### General Rules\n\n1. A" }]),
    );
    expect(e.message).toContain("dir/untitled.md");
  });

  test("ページ ID が重なると、両方のパスを添えて DataError", () => {
    const e = thrown(() =>
      parse([
        { path: "a/README.md", markdown: "# A\n\n#### Sec\n\n1. A\n" },
        { path: "b/a.md", markdown: "# A2\n\n#### Sec\n\n1. B\n" },
      ]),
    );
    expect(e.message).toContain("a/README.md");
    expect(e.message).toContain("b/a.md");
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

  test("GitBook の壊れた参照 /broken/pages/... は、一覧に無ければファイルパスとリンク先を添えて DataError", () => {
    const e = thrown(() =>
      parse([
        ...targets,
        { path: "c/p.md", markdown: "# P\n\n#### Sec\n\n1. See [c](/broken/pages/abc).\n" },
      ]),
    );
    expect(e.message).toContain("c/p.md");
    expect(e.message).toContain("/broken/pages/abc");
  });

  test("/broken/pages/... のリンクも rule-link の修正で直せる", () => {
    const pages = parse(
      [
        ...targets,
        { path: "c/p.md", markdown: "# P\n\n#### Sec\n\n1. See [c](/broken/pages/abc).\n" },
      ],
      [
        {
          kind: "rule-link",
          path: "c/p.md",
          from: "/broken/pages/abc",
          to: { pageId: "b", sectionId: "b#Inner Lineage" },
          reason: "テスト",
        },
      ],
    );
    const c1 = clause(pages, "p#Sec:1");
    expect(c1.text).toContain("[c](b#Inner Lineage)");
    expect(c1.links).toEqual([{ pageId: "b", sectionId: "b#Inner Lineage" }]);
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

    test("同じ path と from の項目が 2 つあると、その from を添えて DataError", () => {
      const fix: Correction = {
        kind: "rule-link",
        path: "glossary/game-terms.md",
        from: "game-terms.md#negated",
        to: { pageId: "game-terms", sectionId: "game-terms#Negated" },
        reason: "テスト",
      };
      const e = thrown(() => parse([negatedPage], [fix, { ...fix, reason: "もう一つ" }]));
      expect(e.message).toContain("game-terms.md#negated");
    });

    test.each([
      ["ページ", { pageId: "no-such-page", sectionId: null }],
      ["節", { pageId: "game-terms", sectionId: "game-terms#No Such Section" }],
    ])("直し先の%sが無い項目は、その from を添えて DataError", (_, to) => {
      const e = thrown(() =>
        parse(
          [negatedPage],
          [
            {
              kind: "rule-link",
              path: "glossary/game-terms.md",
              from: "game-terms.md#negated",
              to,
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

describe("parseRules: <...> で囲んだ画像とリンク、/ で始まるリンク、空になった太字", () => {
  test("<...> で囲んだ画像は条文の text に残らず、前後の文字は残る", () => {
    const pages = parse([
      { path: "p.md", markdown: "# P\n\n#### Sec\n\n1. x ![](<a (1).png>) z\n" },
    ]);
    const c1 = clause(pages, "p#Sec:1");
    expect(c1.text).not.toContain(".png");
    expect(c1.text).not.toContain("![](");
    expect(c1.text).toContain("x");
    expect(c1.text).toContain("z");
  });

  test("画像だけの太字は節にならず、その下の条文は直前の節に入る", () => {
    const pages = parse([
      { path: "p.md", markdown: "# P\n\n#### Sec\n\n1. X\n\n**![](x.png)**\n\n2. Y\n" },
    ]);
    expect(page(pages, "p").sections.map((s) => s.heading)).toEqual(["Sec"]);
    expect(clause(pages, "p#Sec:2").text).toContain("Y");
  });

  test("<a> だけの太字は節にならず、条文は p#A:1 と p#A:2 になる", () => {
    const pages = parse([
      {
        path: "p.md",
        markdown: '# P\n\n#### A\n\n1. x\n\n**<a id="z"></a>**\n\n2. y\n',
      },
    ]);
    expect(page(pages, "p").sections.map((s) => s.heading)).toEqual(["A"]);
    expect(clauses(pages).map((c) => c.clauseId)).toEqual(["p#A:1", "p#A:2"]);
    expect(clause(pages, "p#A:2").text).toContain("y");
  });

  test("<...> で囲んだリンク先は解決される", () => {
    const pages = parse([
      { path: "b/q.md", markdown: "# Q\n\n#### Sec\n\n1. Q.\n" },
      { path: "a/p.md", markdown: "# P\n\n#### Sec\n\n1. See [l](<../b/q.md>).\n" },
    ]);
    const c1 = clause(pages, "p#Sec:1");
    expect(c1.text).toContain("[l](q)");
    expect(c1.links).toEqual([{ pageId: "q", sectionId: null }]);
  });

  test("/ で始まるリンクはルール文書の直下から解決される", () => {
    const pages = parse([
      { path: "b/q.md", markdown: "# Q\n\n#### Sec\n\n1. Q.\n" },
      {
        path: "g/t.md",
        markdown: '# G - T\n\n#### Died <a href="#dies" id="dies"></a>\n\n1. Gone.\n',
      },
      {
        path: "a/p.md",
        markdown: "# P\n\n#### Sec\n\n1. See [x](/b/q.md).\n2. See [g](/g/t.md#dies).\n",
      },
    ]);
    const c1 = clause(pages, "p#Sec:1");
    expect(c1.text).toContain("[x](q)");
    expect(c1.links).toEqual([{ pageId: "q", sectionId: null }]);
    const c2 = clause(pages, "p#Sec:2");
    expect(c2.text).toContain("[g](t#Died)");
    expect(c2.links).toEqual([{ pageId: "t", sectionId: "t#Died" }]);
  });
});

describe("parseRules: hint の後で書き直したリストの続き番号", () => {
  const hint = '{% hint style="info" %}\nH\n{% endhint %}';

  test("hint の前に 2 項目、後に 2 項目あると 1・2・3・4 になる", () => {
    const pages = parse([
      { path: "p.md", markdown: `# P\n\n#### S\n\n1. A\n2. B\n\n${hint}\n\n1. C\n2. D\n` },
    ]);
    expect(clauses(pages).map((c) => c.number)).toEqual(["1", "2", "3", "4"]);
    expect(clause(pages, "p#S:3").text).toContain("C");
    expect(clause(pages, "p#S:4").text).toContain("D");
  });

  test("hint の後のリストに入れ子があると 1・2・2.a・3 になる", () => {
    const pages = parse([
      { path: "p.md", markdown: `# P\n\n#### S\n\n1. A\n\n${hint}\n\n1. B\n   1. x\n2. C\n` },
    ]);
    expect(clauses(pages).map((c) => c.number)).toEqual(["1", "2", "2.a", "3"]);
    expect(clause(pages, "p#S:2.a").text).toContain("x");
    expect(clause(pages, "p#S:3").text).toContain("C");
  });

  test("書き直したリストの途中の箇条書きは直前の条文に入り、番号は 1・2・3 のまま続く", () => {
    const pages = parse([
      {
        path: "p.md",
        markdown: `# P\n\n#### S\n\n1. A\n\n${hint}\n\n1. B\n\n* bullet\n\n2. C\n`,
      },
    ]);
    expect(clauses(pages).map((c) => c.number)).toEqual(["1", "2", "3"]);
    expect(clause(pages, "p#S:2").text).toContain("- bullet");
    expect(clause(pages, "p#S:3").text).toContain("C");
  });
});

// 節 S だけのページ p を作る
const one = (body: string): Page[] =>
  parse([{ path: "p.md", markdown: `# P - Q\n\n#### S\n\n${body}\n` }]);

describe("parseRules: GitBook の記法を本文に残さない", () => {
  test("画像の後ろの行末の `\\` と、`\\` だけの行が残らない（hint は 1 行にまとまる）", () => {
    const pages = one(
      '1. A\n\n{% hint style="info" %}\n![](../../.gitbook/assets/serve.jpg)\\\n\\\nE.g., Ciel\'s mastery resolves.\nSecond line.\n{% endhint %}',
    );
    expect(clause(pages, "p#S:1").text).toBe("A\nExample: Ciel's mastery resolves. Second line.");
  });

  test("<br> が残らない", () => {
    const pages = one("1. A<br>\n\n<br>\n\n2. B");
    expect(clause(pages, "p#S:1").text).toBe("A");
    expect(clause(pages, "p#S:2").text).toBe("B");
  });

  test("<br> を挟んだ単語はつながらない", () => {
    expect(clause(one("1. Draw a card.<br>Then discard."), "p#S:1").text).toBe(
      "Draw a card. Then discard.",
    );
  });

  test("CRLF の行末の `\\` も残らない", () => {
    const pages = parse([{ path: "p.md", markdown: "# P - Q\r\n\r\n#### S\r\n\r\n1. A\\\r\n" }]);
    expect(clause(pages, "p#S:1").text).toBe("A");
  });

  test("強調記号を消してもリンク先は書き換えない", () => {
    const pages = parse([
      { path: "a.md", markdown: "# A\n\n#### _Foo_\n\n1. X\n" },
      {
        path: "p.md",
        markdown: "# P - Q\n\n#### S\n\n1. See [**foo**](a.md#_foo_) and [x](https://x.com/_a_).\n",
      },
    ]);
    const c = clause(pages, "p#S:1");
    expect(c.text).toBe("See [foo](a#_Foo_) and [x](https://x.com/_a_).");
    expect(c.links).toEqual([{ pageId: "a", sectionId: "a#_Foo_" }]);
  });

  test("エスケープの `\\` と強調記号が残らない。崩れた強調も消える", () => {
    const pages = one(
      '1. Uses \\[Name], \\[Title] and **bolded** text.\n2. The flip sid**e** is "_may"_ and _italic_.',
    );
    expect(clause(pages, "p#S:1").text).toBe("Uses [Name], [Title] and bolded text.");
    expect(clause(pages, "p#S:2").text).toBe('The flip side is "may" and italic.');
  });

  test("本文が E.g. で始まる hint は「Example: E.g., 」にならない", () => {
    const pages = one('1. A\n\n{% hint style="info" %}\nE.g., Cards like X.\n{% endhint %}');
    expect(clause(pages, "p#S:1").text).toBe("A\nExample: Cards like X.");
  });

  test("画像と説明文だけの hint は捨てる", () => {
    const pages = one(
      '1. A\n\n{% hint style="success" %}\n<img src="x.jpg" alt=""> <img src="y.jpg" alt="">\n\n_The four pages._\n{% endhint %}\n\n2. B',
    );
    expect(clause(pages, "p#S:1").text).toBe("A");
  });

  test("画像の無い斜体 1 行の hint は説明文ではないので残す", () => {
    const pages = one(
      '1. A\n\n{% hint style="warning" %}\n_Immortality prevents this._\n{% endhint %}',
    );
    expect(clause(pages, "p#S:1").text).toBe("A\nException: Immortality prevents this.");
  });

  test("パンくずの段落 General Rules: は条文にならない", () => {
    const pages = parse([
      { path: "p.md", markdown: "# P - Ending\n\nGeneral Rules:\n\n1. A game ends.\n" },
    ]);
    expect(clauses(pages).map((c) => c.clauseId)).toEqual(["p#Ending:1"]);
  });

  test("子ページの案内と、続くリンクだけの箇条書きは捨てる", () => {
    const pages = parse([
      { path: "a.md", markdown: "# A\n\n#### S\n\n1. X\n" },
      {
        path: "p.md",
        markdown:
          "# P - Q\n\n#### S\n\n1. Last rule.\n\nThe following pages discuss these topics:\n\n* [A](a.md)\n* [A again](a.md)\n",
      },
    ]);
    expect(clause(pages, "p#S:1").text).toBe("Last rule.");
  });

  test("リンクの文字列の前後の空白はリンクの外に出る", () => {
    const pages = parse([
      { path: "a.md", markdown: "# A\n\n#### Loaded Cards\n\n1. X\n" },
      {
        path: "p.md",
        markdown:
          "# P - Q\n\n#### S\n\n1. Its [Loaded Cards ](a.md#loaded-cards)zone, summoned by[ gathering](a.md).\n",
      },
    ]);
    expect(clause(pages, "p#S:1").text).toBe(
      "Its [Loaded Cards](a#Loaded Cards) zone, summoned by [gathering](a).",
    );
  });

  test("文字列がファイル名のリンクは、文字列がリンク先のページ題になる", () => {
    const pages = parse([
      { path: "glossary/game-terms.md", markdown: "# Game Terms\n\n#### S\n\n1. X\n" },
      {
        path: "p.md",
        markdown:
          '# P - Q\n\n#### S\n\n1. Treated as [game-terms.md](glossary/game-terms.md "mention") here.\n',
      },
    ]);
    expect(clause(pages, "p#S:1").text).toBe("Treated as [Game Terms](game-terms) here.");
  });
});

const removeText = (from: string, path = "p.md"): Correction => ({
  kind: "rule-text",
  path,
  from,
  to: "",
  reason: "テスト",
});

describe("parseRules: rule-text の修正", () => {
  const raw: RawPage = {
    path: "p.md",
    markdown: "# P - Q\n\n#### S\n\n1. Shown as below, as shown below.\n",
  };

  test("from を to に置き換える", () => {
    expect(clause(parse([raw], [removeText(", as shown below")]), "p#S:1").text).toBe(
      "Shown as below.",
    );
  });

  test("from が無ければ、その from を添えて DataError", () => {
    expect(thrown(() => parse([raw], [removeText("no such text")])).message).toContain(
      "no such text",
    );
  });

  test("from が 2 か所にあれば DataError", () => {
    expect(thrown(() => parse([raw], [removeText("below")])).message).toContain("2 か所");
  });

  test("path のページが無ければ DataError", () => {
    expect(thrown(() => parse([raw], [removeText(", as shown below", "q.md")])).message).toContain(
      "q.md",
    );
  });
});

// Page.url・Section.url は model.ts にまだ無いので、unknown として読む
const urlOf = (x: object): unknown => (x as { url?: unknown }).url;

function sectionUrl(pages: Page[], pageId: string, sectionId: string): unknown {
  const s = page(pages, pageId).sections.find((x) => x.sectionId === sectionId);
  if (!s) throw new Error(`節 ${sectionId} が無い`);
  return urlOf(s);
}

describe("parseRules: ページと節の URL", () => {
  test("ページの URL は path から作り、#### の節は anchor 付き", () => {
    const pages = parse([{ path: "a/p.md", markdown: "# P\n\n#### General Rules:\n\n1. X\n" }]);
    expect(urlOf(page(pages, "p"))).toBe("https://rules.gatcg.com/a/p");
    expect(sectionUrl(pages, "p", "p#General Rules")).toBe(
      "https://rules.gatcg.com/a/p#general-rules",
    );
  });

  test("見出しの <a id> を、見出しから作る anchor より優先する", () => {
    const pages = parse([
      { path: "a/p.md", markdown: '# P\n\n#### <a id="custom-id"></a>Sec\n\n1. X\n' },
    ]);
    expect(sectionUrl(pages, "p", "p#Sec")).toBe("https://rules.gatcg.com/a/p#custom-id");
  });

  test("### の節はページ URL + 見出しの anchor", () => {
    const pages = parse([
      { path: "a/p.md", markdown: "# P\n\n#### Major\n\n1. A\n\n### Minor Heading\n\n1. B\n" },
    ]);
    expect(sectionUrl(pages, "p", "p#Minor Heading")).toBe(
      "https://rules.gatcg.com/a/p#minor-heading",
    );
  });

  test("行頭の太字で始まる節は # なしのページ URL", () => {
    const pages = parse([
      {
        path: "a/p.md",
        markdown: "# P\n\n#### Major\n\n1. A\n\n**1.1 Announcing Activation**: X\n\n1. B\n",
      },
    ]);
    expect(sectionUrl(pages, "p", "p#1.1 Announcing Activation")).toBe(
      "https://rules.gatcg.com/a/p",
    );
  });

  test("最初の見出しより前の本文(lead 節)は # なしのページ URL", () => {
    const pages = parse([
      { path: "a/p.md", markdown: "# P\n\nIntro text.\n\n#### Major\n\n1. A\n" },
    ]);
    const lead = page(pages, "p").sections.find((s) => s.kind === "lead");
    if (!lead) throw new Error("lead 節が無い");
    expect(urlOf(lead)).toBe("https://rules.gatcg.com/a/p");
  });

  test("README.md のページはディレクトリの URL で、節はその URL に anchor が付く", () => {
    const pages = parse([{ path: "dir/README.md", markdown: "# D\n\n#### Sec Name\n\n1. X\n" }]);
    expect(urlOf(page(pages, "dir"))).toBe("https://rules.gatcg.com/dir");
    expect(sectionUrl(pages, "dir", "dir#Sec Name")).toBe("https://rules.gatcg.com/dir#sec-name");
  });

  test("ID の形と本文中のリンクの形は URL を足しても変わらない", () => {
    const pages = parse([
      { path: "g/game-terms.md", markdown: "# T\n\n#### Dies\n\n1. Dead.\n" },
      {
        path: "a/p.md",
        markdown: "# P\n\n#### General Rules:\n\n1. See [d](../g/game-terms.md#dies).\n",
      },
    ]);
    const c = clause(pages, "p#General Rules:1");
    expect(c.sectionId).toBe("p#General Rules");
    expect(c.text).toContain("[d](game-terms#Dies)");
    expect(c.links).toEqual([{ pageId: "game-terms", sectionId: "game-terms#Dies" }]);
    expect(page(pages, "p").pageId).toBe("p");
  });
});
