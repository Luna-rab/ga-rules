export const RULES_SITE_URL = "https://rules.gatcg.com/";

export function rulesPageUrl(_path: string): string {
  throw new Error("未実装");
}

export function gitbookAnchor(_heading: string): string {
  throw new Error("未実装");
}

export function rulesSectionUrl(_pageUrl: string, _anchor: string | null): string {
  throw new Error("未実装");
}

export function cardUrl(_slug: string): string {
  throw new Error("未実装");
}

export function rulingUrl(_citeId: string): string | null {
  throw new Error("未実装");
}
