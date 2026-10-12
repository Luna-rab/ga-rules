import { describe, expect, test } from "bun:test";
import { openTestContext } from "../../../__tests__/helpers/open-test-context";

const ctx = openTestContext();

describe("リポジトリに渡す語の並び", () => {
  test("空の並びで条文と裁定を検索すると、FTS5 の構文の誤りにならず空を返す", () => {
    expect(ctx.rules.searchClauses([], 7)).toEqual([]);
    expect(ctx.rules.searchRulings([], 3)).toEqual([]);
  });

  test('" を含む語で検索しても FTS5 の構文の誤りにならない', () => {
    expect(() => ctx.rules.searchClauses(['dam"age OR'], 7)).not.toThrow();
    expect(() => ctx.cards.search({ ...emptyQuery, words: ['dr"aw'] }, 20)).not.toThrow();
  });

  test("空の並びでカードを検索すると、語の条件が無いときと同じ結果になる", () => {
    const query = { ...emptyQuery, costType: "memory" };
    expect(ctx.cards.search({ ...query, words: [] }, 20)).toEqual(
      ctx.cards.search({ ...query, words: null }, 20),
    );
  });
});

const emptyQuery = {
  words: null,
  attributes: [],
  costType: null,
  speed: null,
  legalIn: null,
  bannedIn: null,
  ranges: [],
};
