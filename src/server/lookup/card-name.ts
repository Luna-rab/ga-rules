export type NamedCard = { slug: string; name: string };

const MAX_CANDIDATES = 10;
const MIN_SIMILARITY = 0.75;

// 小文字にし、英数字以外を区切りにして語に分ける。
export function nameWords(s: string): string[] {
  return s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (cur[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length] ?? 0;
}

// 語の切れ目を無視して比べる（Fire Ball と Fireball は 1）。
function similarity(a: string[], b: string[]): number {
  const x = a.join("");
  const y = b.join("");
  const longest = Math.max(x.length, y.length);
  return longest === 0 ? 0 : 1 - editDistance(x, y) / longest;
}

// 入力の語がすべて、名前のどれかの語の先頭に一致する。
function matchesByPrefix(query: string[], name: string[]): boolean {
  return query.every((q) => name.some((w) => w.startsWith(q)));
}

// 名前の揺れを吸収して、似たカードを類似度順に最大 10 件返す。total は打ち切る前の候補の数。
// 先頭一致か、綴りの類似度が 0.75 以上のものを選ぶ。
export function findSimilarCards(
  query: string,
  cards: NamedCard[],
): { cards: NamedCard[]; total: number } {
  const q = nameWords(query);
  if (q.length === 0) return { cards: [], total: 0 };
  const qLength = q.join("").length;

  const scored: { card: NamedCard; score: number }[] = [];
  for (const card of cards) {
    const n = nameWords(card.name);
    const sim = similarity(q, n);
    const prefix = matchesByPrefix(q, n);
    if (!prefix && sim < MIN_SIMILARITY) continue;
    const prefixScore = prefix ? MIN_SIMILARITY + 0.2 * (qLength / n.join("").length) : 0;
    scored.push({ card, score: Math.max(sim, prefixScore) });
  }
  const sorted = scored.toSorted(
    (a, b) =>
      b.score - a.score ||
      a.card.name.localeCompare(b.card.name) ||
      a.card.slug.localeCompare(b.card.slug),
  );
  return { cards: sorted.slice(0, MAX_CANDIDATES).map((s) => s.card), total: sorted.length };
}
