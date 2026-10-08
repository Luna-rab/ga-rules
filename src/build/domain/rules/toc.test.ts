import { describe, expect, test } from "bun:test";
import { OVERVIEW_PAGE_IDS } from "../../../shared/overview";
import { DataError } from "../errors";
import type { Page } from "../model";
import { assertOverviewPages, parseToc } from "./toc";

function pageOf(pageId: string): Page {
  return { pageId, title: pageId, url: `https://rules.gatcg.com/${pageId}`, sections: [] };
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

const SUMMARY = `# Table of contents

* [Changelog](README.md)
* [Table of Contents](table-of-contents.md)
* [General Rules](general-rules/README.md)
  * [General Rules - Objectives](general-rules/general-rules-objectives.md)
`;

const PAGES = [pageOf("general-rules"), pageOf("general-rules-objectives")];

describe("parseToc", () => {
  test("入れ子で親子を決め、position は目次を上から読んだ順に 0 から増える", () => {
    expect(parseToc(SUMMARY, PAGES)).toEqual([
      { pageId: "general-rules", parentPageId: null, position: 0 },
      { pageId: "general-rules-objectives", parentPageId: "general-rules", position: 1 },
    ]);
  });

  test("README.md と table-of-contents.md の項目は返さない", () => {
    const ids = parseToc(SUMMARY, PAGES).map((e) => e.pageId);

    expect(ids).not.toContain("README.md");
    expect(ids).not.toContain("table-of-contents");
    expect(ids).toHaveLength(2);
  });

  test("深さが戻ると、直前の浅い項目の下ではなく同じ深さの親に付く", () => {
    const summary = `# Table of contents

* [A](a.md)
  * [B](b/b.md)
    * [C](c.md)
  * [D](d.md)
* [E](e.md)
`;
    const entries = parseToc(summary, ["a", "b", "c", "d", "e"].map(pageOf));

    expect(entries).toEqual([
      { pageId: "a", parentPageId: null, position: 0 },
      { pageId: "b", parentPageId: "a", position: 1 },
      { pageId: "c", parentPageId: "b", position: 2 },
      { pageId: "d", parentPageId: "a", position: 3 },
      { pageId: "e", parentPageId: null, position: 4 },
    ]);
  });

  test("目次にあって pages に無いページは DataError で、message にページ ID が入る", () => {
    const error = thrown(() => parseToc(SUMMARY, [pageOf("general-rules")]));

    expect(error.message).toContain("general-rules-objectives");
  });

  test("pages にあって目次に無いページは DataError", () => {
    thrown(() => parseToc(SUMMARY, [...PAGES, pageOf("orphan-page")]));
  });
});

describe("assertOverviewPages", () => {
  test("5 ページすべてがあれば投げない", () => {
    expect(() => assertOverviewPages(OVERVIEW_PAGE_IDS.map(pageOf))).not.toThrow();
  });

  test("general-rules-card-types だけが欠けると DataError で、message にそのページ ID が入る", () => {
    const pages = OVERVIEW_PAGE_IDS.filter((id) => id !== "general-rules-card-types").map(pageOf);

    expect(thrown(() => assertOverviewPages(pages)).message).toContain("general-rules-card-types");
  });
});
