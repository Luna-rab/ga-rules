import type { RuleUrls } from "../../domain/model";
import { replaceRuleLinks } from "../../domain/rule-link";

// 本文の [文言](target) のうち、target が urls にあるものを [文言](URL) [target] にする
export function rewriteRuleLinks(text: string, urls: RuleUrls): string {
  return replaceRuleLinks(text, ({ whole, label, target }) => {
    const url = urls.get(target);
    return url === undefined ? whole : `[${label}](${url}) [${target}]`;
  });
}

// URL が引けなければ今の [id] の形で出す
export function citeLink(id: string, url: string | undefined): string {
  return url === undefined ? `[${id}]` : `[${id}](${url})`;
}
