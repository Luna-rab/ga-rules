import { parseRulingCiteId } from "./cite";

export const RULES_SITE_URL = "https://rules.gatcg.com/";
const INDEX_SITE_URL = "https://index.gatcg.com/";

// path は data/rules からの相対パス。`.../README.md` はディレクトリのパスになる
export function rulesPageUrl(path: string): string {
  const withoutExt = path.replace(/\.md$/, "");
  const dir = withoutExt === "README" ? "" : withoutExt.replace(/\/README$/, "");
  return RULES_SITE_URL + dir;
}

// GitBook が見出しから作るアンカー: 小文字・記号除去・空白をハイフン
export function gitbookAnchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9 _-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function rulesSectionUrl(pageUrl: string, anchor: string | null): string {
  return anchor === null ? pageUrl : `${pageUrl}#${anchor}`;
}

export function cardUrl(slug: string): string {
  return `${INDEX_SITE_URL}card/${slug}`;
}

export function rulingUrl(citeId: string): string | null {
  const cite = parseRulingCiteId(citeId);
  return cite ? cardUrl(cite.cardSlug) : null;
}
