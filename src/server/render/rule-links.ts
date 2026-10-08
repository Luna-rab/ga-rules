// キーは page_id と section_id、値は公式サイトの URL
export type RuleUrls = ReadonlyMap<string, string>;

export function rewriteRuleLinks(_text: string, _urls: RuleUrls): string {
  throw new Error("rewriteRuleLinks は未実装");
}
