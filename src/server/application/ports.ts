import type { CardQuery } from "../domain/card-query";
import type {
  CardDetail,
  CardHit,
  CardSummary,
  ClauseHit,
  PageNode,
  RulingHit,
} from "../domain/model";

export type RuleRepository = {
  // 節と条文は文書の順。ページが無ければ null
  readPage: (pageId: string) => PageNode | null;
  // words のどれか 1 語を含む条文を関連度順に
  searchClauses: (words: string[], limit: number) => ClauseHit[];
  // words のどれか 1 語を含む裁定を関連度順に。ERRATA は除き、同じ文面は 1 件にまとめる
  searchRulings: (words: string[], limit: number) => RulingHit[];
};

export type CardRepository = {
  // 渡した slug の順に並べる。索引に無い slug は飛ばす
  readSummaries: (slugs: string[]) => CardSummary[];
  // 条件をすべて満たすカードの総件数と、先頭 SEARCH_LIMIT 件。語があれば関連度順、無ければ名前順
  search: (q: CardQuery) => { total: number; hits: CardHit[] };
  // slug のカードが無ければ null
  readDetail: (slug: string) => CardDetail | null;
};
