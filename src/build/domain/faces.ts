import { DataError } from "./errors";
import type { Card, CardFace } from "./model";

// card テーブルの 1 行。両面カードの裏面も自分の slug で 1 行になり、frontSlug で表を指す
export type CardRow = CardFace & {
  frontSlug: string | null;
  legality: Card["legality"];
};

function toRow(face: CardFace, frontSlug: string | null, legality: Card["legality"]): CardRow {
  const { slug, name, types, subtypes, classes, elements, cost } = face;
  const { level, power, life, durability, speed, effect_raw } = face;
  return {
    slug,
    name,
    types,
    subtypes,
    classes,
    elements,
    cost,
    level,
    power,
    life,
    durability,
    speed,
    effect_raw,
    frontSlug,
    legality,
  };
}

// 表をすべて並べてから裏面を並べる（裏面の front_slug が表を外部キーで指すため）。
// 裏面には禁止の列が無い。表が禁止のとき裏面だけが合法に見えないよう、表の値を写す
export function toCardRows(cards: Card[]): CardRow[] {
  const rows = [
    ...cards.map((c) => toRow(c, null, c.legality)),
    ...cards.flatMap((c) => (c.back ? [toRow(c.back, c.slug, c.legality)] : [])),
  ];
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.slug)) {
      throw new DataError(r.slug, `slug が重なる（裏面の表は ${r.frontSlug ?? "なし"}）`);
    }
    seen.add(r.slug);
  }
  return rows;
}
