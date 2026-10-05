import type { Correction } from "../corrections";
import { DataError } from "../errors";
import type { Clause, LinkTarget, Page, RawPage, Section } from "../model";

type DraftClause = { number: string; lines: string[] };
type DraftSection = { heading: string; anchorIds: string[]; clauses: DraftClause[] };
type DraftPage = {
  path: string;
  pageId: string;
  title: string;
  body: string;
  sections: DraftSection[];
};

export function parseRules(raw: RawPage[], corrections: readonly Correction[]): Page[] {
  const drafts = raw.map(splitPage);
  const resolver = new LinkResolver(drafts, corrections);
  const pages = drafts.map((d) => buildPage(d, resolver));
  resolver.assertAllCorrectionsUsed();
  return pages;
}

function pageIdOf(path: string): string {
  const parts = path.split("/");
  const file = parts.at(-1) ?? "";
  if (file === "README.md") return parts.at(-2) ?? "";
  return file.replace(/\.md$/, "");
}

// --- 前処理 ---

function clean(markdown: string): string {
  return markdown
    .replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/, "")
    .replace(/<img\b[^>]*>/g, "")
    .replace(/!\[[^\]]*\]\((?:<[^>]*>|[^)]*)\)/g, "")
    .replaceAll("&#x20;", " ");
}

function cleanHeading(raw: string): { heading: string; anchorIds: string[] } {
  const anchorIds = [...raw.matchAll(/<a\b[^>]*\bid="([^"]*)"[^>]*>/g)].map((m) => m[1] ?? "");
  const heading = raw
    .replace(/<a\b[^>]*>[\s\S]*?<\/a>/g, "")
    .replace(/<a\b[^>]*>/g, "")
    .trim()
    .replace(/:$/, "")
    .trim();
  return { heading, anchorIds };
}

// GitBook が見出しから作るアンカー: 小文字・記号除去・空白をハイフン
function gitbookAnchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9 _-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// --- ページ → 節 → 条文 ---

const HINT_OPEN = /^\s*\{%\s*hint\b([^%]*)%\}\s*$/;
const HINT_CLOSE = /^\s*\{%\s*endhint\s*%\}\s*$/;
const LIST_ITEM = /^( *)(\d+)\.(\s+)(.*)$/;

function hintPrefix(attrs: string): string {
  const style = /style="([^"]*)"/.exec(attrs)?.[1];
  return style === "warning" || style === "danger" ? "例外: " : "例: ";
}

function splitPage(raw: RawPage): DraftPage {
  const pageId = pageIdOf(raw.path);
  const lines = clean(raw.markdown).split(/\r?\n/);
  const titleAt = lines.findIndex((l) => l.startsWith("# "));
  if (titleAt < 0) throw new DataError(raw.path, "ページ題（# で始まる行）が無い");
  const title = (lines[titleAt] ?? "").slice(2).trim();

  const sections: DraftSection[] = [];
  let section: DraftSection | null = null;
  let clause: DraftClause | null = null;
  let stack: { contentCol: number; label: string }[] = [];

  const ensureSection = (): DraftSection => {
    if (section) return section;
    section = { heading: title.split(" - ").at(-1)?.trim() ?? title, anchorIds: [], clauses: [] };
    sections.push(section);
    return section;
  };
  const ensureClause = (): DraftClause => {
    if (clause) return clause;
    clause = { number: "0", lines: [] };
    ensureSection().clauses.push(clause);
    return clause;
  };

  // hint だけを挟んで番号付きリストが書き直されたら（`1.` → hint → `1.`）、続き番号にする。
  // hint は直前の条文に含めるので、リストは途切れていないものとして扱う
  let lastTop = 0;
  let afterHint = false;
  const startSection = (heading: string, anchorIds: string[]): void => {
    section = { heading, anchorIds, clauses: [] };
    sections.push(section);
    clause = null;
    stack = [];
    lastTop = 0;
    afterHint = false;
  };

  for (let i = titleAt + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    // `####` に加え、`###` と行頭の太字（`**Leveling Up**`・`**1.1 Announcing Activation**: ...`）も
    // 節の区切りにする。どれも下で番号付きリストが 1 から振り直される
    const heading = /^#{3,4} (.*)$/.exec(line);
    if (heading) {
      const h = cleanHeading(heading[1] ?? "");
      // 画像を消して空になった見出しは節にせず、直前の節を続ける
      if (h.heading === "") {
        afterHint = false;
        continue;
      }
      startSection(h.heading, h.anchorIds);
      continue;
    }
    const bold = /^\*\*([^*]+)\*\*(.*)$/.exec(line);
    if (bold) {
      const boldHeading = cleanHeading(bold[1] ?? "").heading;
      const rest = (bold[2] ?? "").replace(/^\s*:?\s*/, "").trim();
      // 空になった見出しは `####` と同じく節にせず、直前の節を続ける
      if (boldHeading === "") afterHint = false;
      else startSection(boldHeading, []);
      if (rest !== "") ensureClause().lines.push(rest);
      continue;
    }
    const hint = HINT_OPEN.exec(line);
    if (hint) {
      const body: string[] = [];
      for (i++; i < lines.length && !HINT_CLOSE.test(lines[i] ?? ""); i++) {
        const t = (lines[i] ?? "").trim();
        if (t !== "") body.push(t);
      }
      if (i >= lines.length) throw new DataError(raw.path, `{% endhint %} が無い: ${line.trim()}`);
      const target = ensureClause();
      target.lines.push(hintPrefix(hint[1] ?? "") + body.join("\n"));
      afterHint = true;
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      const indent = (item[1] ?? "").length;
      let n = Number(item[2]);
      while (stack.length > 0 && indent < (stack.at(-1)?.contentCol ?? 0) - 1) stack.pop();
      if (stack.length === 0) {
        if (afterHint && n <= lastTop) n = lastTop + 1;
        lastTop = n;
      }
      afterHint = false;
      const label = formatNumber(n, stack.length);
      const number = [...stack.map((s) => s.label), label].join(".");
      stack.push({
        contentCol: indent + (item[2] ?? "").length + 1 + (item[3] ?? "").length,
        label,
      });
      clause = { number, lines: [(item[4] ?? "").trim()] };
      ensureSection().clauses.push(clause);
      continue;
    }
    const text = line.trim();
    if (text === "") continue;
    afterHint = false;
    ensureClause().lines.push(text);
  }

  const body = lines
    .filter((l) => !HINT_CLOSE.test(l))
    .map((l) => {
      const hint = HINT_OPEN.exec(l);
      return hint ? hintPrefix(hint[1] ?? "").trim() : l.replace(/[ \t]+$/, "");
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { path: raw.path, pageId, title, body, sections };
}

// 深さ 0 は 10、1 は a、2 は i。4 段目からは繰り返す
function formatNumber(n: number, depth: number): string {
  switch (depth % 3) {
    case 1:
      return toAlpha(n);
    case 2:
      return toRoman(n);
    default:
      return String(n);
  }
}

function toAlpha(n: number): string {
  let s = "";
  for (let k = n; k > 0; k = Math.floor((k - 1) / 26)) {
    s = String.fromCharCode(97 + ((k - 1) % 26)) + s;
  }
  return s;
}

function toRoman(n: number): string {
  const table: [number, string][] = [
    [1000, "m"],
    [900, "cm"],
    [500, "d"],
    [400, "cd"],
    [100, "c"],
    [90, "xc"],
    [50, "l"],
    [40, "xl"],
    [10, "x"],
    [9, "ix"],
    [5, "v"],
    [4, "iv"],
    [1, "i"],
  ];
  let s = "";
  let k = n;
  for (const [v, r] of table) {
    for (; k >= v; k -= v) s += r;
  }
  return s;
}

function buildPage(d: DraftPage, resolver: LinkResolver): Page {
  const sectionIds = new Set<string>();
  const clauseIds = new Set<string>();
  const sections: Section[] = d.sections.map((s) => {
    const sectionId = `${d.pageId}#${s.heading}`;
    if (sectionIds.has(sectionId)) throw new DataError(d.path, `節 ID が重なる: ${sectionId}`);
    sectionIds.add(sectionId);
    const clauses: Clause[] = s.clauses.map((c) => {
      const clauseId = `${sectionId}:${c.number}`;
      if (clauseIds.has(clauseId)) throw new DataError(d.path, `条文 ID が重なる: ${clauseId}`);
      clauseIds.add(clauseId);
      const { text, links } = resolver.rewrite(d.path, c.lines.join("\n"));
      return { clauseId, sectionId, number: c.number, text, links };
    });
    return { sectionId, pageId: d.pageId, heading: s.heading, clauses };
  });
  const body = resolver.rewrite(d.path, d.body).text;
  return { pageId: d.pageId, title: d.title, body, sections };
}

// --- リンクの解決と書き換え ---

// ラベルは 1 段の角括弧の入れ子まで（`[a [b] c]`）。括弧の中は `href` か `href "title"`
const LINK = /\[((?:[^[\]]|\[[^[\]]*\])*)\]\(\s*(<[^>]*>|[^)\s]*)(?:\s+"[^"]*")?\s*\)/g;

class LinkResolver {
  private readonly byPath = new Map<string, DraftPage>();
  private readonly fixes = new Map<string, Extract<Correction, { kind: "rule-link" }>>();
  private readonly used = new Set<string>();

  constructor(pages: DraftPage[], corrections: readonly Correction[]) {
    const byPageId = new Map<string, DraftPage>();
    for (const p of pages) {
      const other = byPageId.get(p.pageId);
      if (other) {
        throw new DataError(p.path, `ページ ID ${p.pageId} が ${other.path} と重なる`);
      }
      byPageId.set(p.pageId, p);
      this.byPath.set(p.path, p);
    }
    for (const c of corrections) {
      if (c.kind !== "rule-link") continue;
      const where = `correction rule-link ${c.path}`;
      const key = fixKey(c.path, c.from);
      if (this.fixes.has(key)) throw new DataError(where, `リンク ${c.from} の項目が重なる`);
      if (c.to) {
        const page = byPageId.get(c.to.pageId);
        const sectionId = c.to.sectionId;
        const found =
          page &&
          (sectionId === null ||
            page.sections.some((s) => `${page.pageId}#${s.heading}` === sectionId));
        if (!found) {
          throw new DataError(
            where,
            `リンク ${c.from} の直し先 ${sectionId ?? c.to.pageId} が無い`,
          );
        }
      }
      this.fixes.set(key, c);
    }
  }

  rewrite(path: string, text: string): { text: string; links: LinkTarget[] } {
    const links: LinkTarget[] = [];
    const out = text.replace(LINK, (whole, label: string, rawHref: string) => {
      const href = rawHref.replace(/^<(.*)>$/, "$1");
      const key = fixKey(path, href);
      const fix = this.fixes.get(key);
      if (fix) {
        this.used.add(key);
        if (fix.to === null) return label;
        links.push(fix.to);
        return `[${label}](${fix.to.sectionId ?? fix.to.pageId})`;
      }
      if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return whole;
      if (href.includes(".gitbook/assets/")) return label;
      const target = this.resolve(path, href);
      links.push(target);
      return `[${label}](${target.sectionId ?? target.pageId})`;
    });
    return { text: out, links: dedupe(links) };
  }

  assertAllCorrectionsUsed(): void {
    for (const [key, fix] of this.fixes) {
      if (!this.used.has(key)) {
        throw new DataError(
          `correction rule-link ${fix.path}`,
          `リンク ${fix.from} がどこにも無い`,
        );
      }
    }
  }

  private resolve(path: string, href: string): LinkTarget {
    const hashAt = href.indexOf("#");
    const filePart = hashAt < 0 ? href : href.slice(0, hashAt);
    const anchor = hashAt < 0 ? "" : safeDecode(href.slice(hashAt + 1));
    const page = filePart === "" ? this.byPath.get(path) : this.findPage(path, filePart);
    if (!page) throw new DataError(path, `リンク先のページが無い: ${href}`);
    if (anchor === "") return { pageId: page.pageId, sectionId: null };
    const section =
      page.sections.find((s) => s.anchorIds.includes(anchor)) ??
      page.sections.find((s) => gitbookAnchor(s.heading) === anchor.toLowerCase());
    if (!section) throw new DataError(path, `リンク先の節が無い: ${href}`);
    return { pageId: page.pageId, sectionId: `${page.pageId}#${section.heading}` };
  }

  private findPage(from: string, filePart: string): DraftPage | undefined {
    const joined = joinPath(from, safeDecode(filePart));
    if (joined.endsWith(".md")) return this.byPath.get(joined);
    const dir = joined.replace(/\/$/, "");
    return this.byPath.get(dir === "" ? "README.md" : `${dir}/README.md`);
  }
}

// %xx の壊れたリンクは、そのまま照らして解決できないものとして扱う
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function fixKey(path: string, from: string): string {
  return `${path}\u0000${from}`;
}

// from のファイルのディレクトリから rel を解決する。`/` で始まる rel は data/rules の直下から。
// data/rules からの相対パスを返す
function joinPath(from: string, rel: string): string {
  const parts = rel.startsWith("/") ? [] : from.split("/").slice(0, -1);
  for (const seg of rel.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  const trailing = rel.endsWith("/") || rel === "." || rel === "./" || rel === "";
  return parts.join("/") + (trailing && !rel.endsWith(".md") ? "/" : "");
}

function dedupe(links: LinkTarget[]): LinkTarget[] {
  const seen = new Set<string>();
  return links.filter((l) => {
    const k = `${l.pageId}\u0000${l.sectionId ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
