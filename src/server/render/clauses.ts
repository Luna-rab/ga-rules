import type { RuleUrls } from "./rule-links";

export type ClauseNode = { clauseId: string; text: string };
export type SectionNode = {
  sectionId: string;
  heading: string;
  url: string;
  clauses: ClauseNode[];
};

// 条文の行頭に [clause_id] を付ける。ID の組み立てをモデルに任せない。
export function renderClause(c: ClauseNode): string {
  return `[${c.clauseId}] ${c.text}`;
}

export function renderSections(sections: SectionNode[], _urls: RuleUrls): string {
  return sections
    .map((s) => [`#### ${s.heading}`, ...s.clauses.map(renderClause)].join("\n"))
    .join("\n\n");
}
