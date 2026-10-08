// キーは page_id と section_id、値は公式サイトの URL
export type RuleUrls = ReadonlyMap<string, string>;

// target は節見出しを含むので、空白と 1 段の括弧（例: game-terms#Lineage (term)）を許す
const LINK = /\[([^\]]*)\]\(((?:[^()]|\([^()]*\))+)\)/g;

// 本文の [文言](target) のうち、target が urls にあるものを [文言](URL) [target] にする
export function rewriteRuleLinks(text: string, urls: RuleUrls): string {
  return text.replace(LINK, (whole, label: string, target: string) => {
    const url = urls.get(target);
    return url === undefined ? whole : `[${label}](${url}) [${target}]`;
  });
}

// URL が引けなければ今の [id] の形で出す
export function citeLink(id: string, url: string | undefined): string {
  return url === undefined ? `[${id}]` : `[${id}](${url})`;
}
