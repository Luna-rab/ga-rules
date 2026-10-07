import { z } from "zod";

// fetch:data が書く data/cards/<slug>.json の形。fetch と raw-store が同じ定義で検査する。
// 要件に使う列だけを定義する。z.object は定義に無いキーを落とすので、ここに無い列は保存されない。
// 各列を残す理由・捨てる理由は DESIGN.md の「カードの取り込み」を参照。
// 両面カードの裏面も同じ列を持つ（API の editions[].other_orientations[]）。
export const CardFaceSchema = z.object({
  // ファイル名に使う。英小文字・数字・ハイフン以外が来たら、パスを壊す前に止める。
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  types: z.array(z.string()),
  subtypes: z.array(z.string()),
  classes: z.array(z.string()),
  // element は 1 つしか持たず、Exalted のカードでは EXALTED だけになって Fire などの条件が落ちる。
  // プレイに要る元素はすべて elements にある。
  elements: z.array(z.string()),
  // cost_reserve / cost_memory は X コストを -1 で表すので使わない。
  cost: z.object({ type: z.string(), value: z.string().nullable() }),
  level: z.number().nullable(),
  power: z.number().nullable(),
  life: z.number().nullable(),
  durability: z.number().nullable(),
  speed: z.boolean().nullable(),
  effect_raw: z.string().nullable(),
});

export const CardSchema = CardFaceSchema.extend({
  rule: z
    .array(z.object({ title: z.string(), date_added: z.string(), description: z.string() }))
    .nullable(),
  references: z
    .array(
      z.object({ kind: z.string(), name: z.string(), slug: z.string(), direction: z.string() }),
    )
    .nullable(),
  legality: z.record(z.string(), z.object({ limit: z.number() })).nullable(),
  // 両面カードの裏面。片面のカードは null
  back: CardFaceSchema.nullable(),
});
