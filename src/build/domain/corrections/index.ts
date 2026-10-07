import { DataError } from "../errors";
import type { Card, LinkTarget, Ruling } from "../model";
import { ERRATA_CORRECTIONS } from "./errata";

export type Correction =
  | { kind: "card-reference"; cardSlug: string; from: string; to: string; reason: string } // references[].slug を直す
  | { kind: "rule-link"; path: string; from: string; to: LinkTarget | null; reason: string } // path は RawPage.path、from はリンクの括弧内そのまま。null はリンクを外して文字だけ残す
  | { kind: "rule-text"; path: string; from: string; to: string; reason: string } // 原文の from（ページに 1 か所だけ）を to に置き換える。一般の規則で直せない文の崩れに使う
  | { kind: "card-text"; cardSlug: string; from: string; to: string; reason: string } // effect_raw の from（1 か所だけ）を to に置き換える。ERRATA を効果テキストに当てるのに使う
  | { kind: "ruling-title"; citeId: string; to: string; reason: string }; // 裁定の題を直す

const CRYSTAL_MASTERY_REASON =
  "API に crystal-mastery のカードは無く（404）、参照の name は Fractured Memories";

export const CORRECTIONS: readonly Correction[] = [
  ...[
    "merlin-amethysts-glow",
    "luminous-quartz",
    "materialize-the-soul",
    "stand-before-the-queen",
    "merlin-brilliant-vestige",
  ].map((cardSlug): Correction => ({
    kind: "card-reference",
    cardSlug,
    from: "crystal-mastery",
    to: "fractured-memories",
    reason: CRYSTAL_MASTERY_REASON,
  })),
  {
    kind: "rule-link",
    path: "glossary/game-terms.md",
    from: "game-terms.md#negated",
    to: { pageId: "game-terms", sectionId: "game-terms#Negated" },
    reason:
      "見出しが「Negated&#x20;」で末尾に空白の実体参照が付き、GitBook 上で #negated のリンクが節に飛ばない。同じページの Negated の節を指す",
  },
  {
    kind: "rule-link",
    path: "general-rules/general-rules-card-types/card-types-supertypes.md",
    from: "../general-rules-card-characteristics/#changing-characteristics-type-overwriting-and-type-setting",
    to: {
      pageId: "general-rules-card-characteristics",
      sectionId: "general-rules-card-characteristics#Type-Overwriting and Type-setting",
    },
    reason:
      "リンク先の見出しが「Type-Overwriting and Type-setting」に改名され、アンカーが古いまま。改名後の節を指す",
  },
  {
    kind: "rule-text",
    path: "game-mechanics/game-mechanics-types-of-effects/types-of-effects-continuous-effects/README.md",
    from: " See [here](../../../glossary/game-terms.md#have-gain-get-become-are).",
    to: "",
    reason:
      "リンク先の節が無い（game-terms.md に have・gain・get・become・are の見出しが無い）。リンクを外すと「See here.」だけが残るので文ごと消す",
  },
  {
    kind: "rule-text",
    path: "game-mechanics/game-mechanics-mastery.md",
    from: ", as shown below",
    to: "",
    reason:
      "下にあった 4 ページの図は画像なので取り込みで消える。図を指す言葉だけが残らないようにする",
  },
  {
    kind: "rule-link",
    path: "game-mechanics/game-mechanics-types-of-effects/types-of-effects-continuous-effects/README.md",
    from: "/broken/pages/d5fQPRV40fjs6PztDRCI",
    to: {
      pageId: "general-rules-card-characteristics",
      sectionId: "general-rules-card-characteristics#General Rules",
    },
    reason:
      "GitBook の壊れたリンク（/broken/pages/）。リンクの文字が characteristics なので、カードの特性のページの General Rules を指す",
  },
  {
    kind: "ruling-title",
    citeId: "archon-broadsword#ruling:2026-08-16:1",
    to: "ERRATA",
    reason:
      "題が空だが、説明は use this weapon for an attack, pay 2. -> wield this weapon, pay 2. という効果テキストの書き換えで、同じ日のほかのカードの ERRATA と同じ言い換え",
  },
  ...ERRATA_CORRECTIONS,
];

// card-reference と card-text の項目を当てる。当たらない項目は名指しして DataError
export function applyCardCorrections(cards: Card[], corrections: readonly Correction[]): Card[] {
  const out = cards.map((c) => (c.references ? { ...c, references: [...c.references] } : c));
  for (const fix of corrections) {
    if (fix.kind === "card-text") {
      applyCardText(out, fix);
      continue;
    }
    if (fix.kind !== "card-reference") continue;
    const target = out.find((c) => c.slug === fix.cardSlug);
    if (!target) {
      throw new DataError(
        `correction card-reference ${fix.cardSlug}`,
        `カード ${fix.cardSlug} が無い（${fix.from} → ${fix.to}）`,
      );
    }
    const refs = target.references ?? [];
    const hits = refs.filter((r) => r.slug === fix.from);
    if (hits.length === 0) {
      throw new DataError(
        `correction card-reference ${fix.cardSlug}`,
        `参照 ${fix.from} が無い（→ ${fix.to}）`,
      );
    }
    target.references = refs.map((r) => (r.slug === fix.from ? { ...r, slug: fix.to } : r));
  }
  return out;
}

// from は効果テキストにちょうど 1 回現れなければならない
function applyCardText(cards: Card[], fix: Extract<Correction, { kind: "card-text" }>): void {
  const where = `correction card-text ${fix.cardSlug}`;
  const i = cards.findIndex((c) => c.slug === fix.cardSlug);
  const target = cards[i];
  if (!target) throw new DataError(where, `カード ${fix.cardSlug} が無い`);
  const effect = target.effect_raw ?? "";
  const count = effect.split(fix.from).length - 1;
  if (count !== 1)
    throw new DataError(where, `文 ${fix.from} が ${count} か所にある（1 か所のはず）`);
  cards[i] = { ...target, effect_raw: effect.replace(fix.from, () => fix.to) };
}

// ruling-title の項目を当てる。cite ID の裁定が無い項目は名指しして DataError
export function applyRulingCorrections(
  rulings: Ruling[],
  corrections: readonly Correction[],
): Ruling[] {
  const out = [...rulings];
  for (const fix of corrections) {
    if (fix.kind !== "ruling-title") continue;
    const i = out.findIndex((r) => r.citeId === fix.citeId);
    const target = out[i];
    if (!target) throw new DataError(`correction ruling-title ${fix.citeId}`, "裁定が無い");
    out[i] = { ...target, title: fix.to };
  }
  return out;
}
