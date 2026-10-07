import { DataError } from "../errors";
import type { Card, Ruling } from "../model";

export type Errata = { from: string; to: string };

// 説明が「直す前 -> 直した後」の形なら両側を返す。矢印が 0 本か 2 本以上なら null
export function parseErrata(description: string): Errata | null {
  const parts = description.split(/->|→/);
  if (parts.length !== 2) return null;
  const [from, to] = parts.map((p) => p.trim());
  if (!from || !to) return null;
  return { from, to };
}

// ERRATA の文面は効果テキストと書き方が揃っていない（’ と '、pay 2 と pay (2)、power と POWER、
// 前後の引用符や「..」、♥ と LIFE）。比べる前に両方をこの形にそろえる。
// 効果テキストはアイコンを POWER・LIFE と書くが、ERRATA には ♥ が 1 件ある（+X life -> +X♥）
export function normalize(s: string, opts: { keepCase?: boolean } = {}): string {
  const quotes = s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replaceAll("♥", "LIFE");
  return (opts.keepCase ? quotes : quotes.toLowerCase())
    .replace(/\((\d+|x)\)/gi, "$1")
    .replace(/\s+/g, "");
}

function side(s: string, opts: { keepCase?: boolean } = {}): string {
  return normalize(s, opts).replace(/^['".]+|['".]+$/g, "");
}

// 直す前の文面が効果テキストに残っているか。直した後の文面が直す前の文面に含まれる ERRATA
// （語を消すもの、大文字小文字だけを変えるもの）は、当てたあとも両方が見つかるので直す前の文面だけで決める
function isPending(effect: string, errata: Errata): boolean {
  // 大文字小文字だけを変える ERRATA（Token -> token）は、大文字小文字を区別して比べる
  const keepCase = side(errata.from) === side(errata.to);
  const [from, to] = [side(errata.from, { keepCase }), side(errata.to, { keepCase })];
  const text = normalize(effect, { keepCase });
  if (from === "" || !text.includes(from)) return false;
  return from.includes(to) || !text.includes(to);
}

// 効果テキストに当たっていない ERRATA を返す
export function findPendingErrata(
  cards: Card[],
  rulings: Ruling[],
): { ruling: Ruling; errata: Errata }[] {
  // 裁定は表のカードに付くが、両面カードでは裏面の文を直すもの・両面に当てはまるものがある。両面とも確かめる
  const effects = new Map(
    cards.map((c) => [c.slug, [c.effect_raw ?? "", ...(c.back ? [c.back.effect_raw ?? ""] : [])]]),
  );
  const pending: { ruling: Ruling; errata: Errata }[] = [];
  for (const ruling of rulings) {
    if (!ruling.title.startsWith("ERRATA")) continue;
    // 矢印の無い ERRATA（直した後の文全体、Type の追加など）は、どこを直すかが決まらないので確かめない
    const errata = parseErrata(ruling.description);
    if (errata && (effects.get(ruling.cardSlug) ?? []).some((e) => isPending(e, errata))) {
      pending.push({ ruling, errata });
    }
  }
  return pending;
}

// 取得し直して ERRATA が増えたときに気付けるよう、効果テキストに当たっていない ERRATA があればビルドを止める
export function assertErrataApplied(cards: Card[], rulings: Ruling[]): void {
  const pending = findPendingErrata(cards, rulings);
  if (pending.length === 0) return;
  const lines = pending.map(
    ({ ruling, errata }) => `${ruling.citeId}: ${errata.from} -> ${errata.to}`,
  );
  throw new DataError(
    "errata",
    `効果テキストに当たっていない ERRATA が ${pending.length} 件ある。修正の一覧に card-text を足す\n${lines.join("\n")}`,
  );
}
