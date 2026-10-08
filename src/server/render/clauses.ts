import { rewriteRuleLinks, type RuleUrls } from "./rule-links";

export type ClauseNode = { clauseId: string; text: string };
export type SectionNode = {
  sectionId: string;
  heading: string;
  url: string;
  clauses: ClauseNode[];
};

// 条文の行頭に [clause_id] を付ける。ID の組み立てをモデルに任せない。
export function renderClause(c: ClauseNode, urls: RuleUrls): string {
  return `[${c.clauseId}] ${rewriteRuleLinks(c.text, urls)}`;
}

export function renderSections(sections: SectionNode[], urls: RuleUrls): string {
  return sections
    .map((s) =>
      [`#### ${s.heading} (${s.url})`, ...s.clauses.map((c) => renderClause(c, urls))].join("\n"),
    )
    .join("\n\n");
}
