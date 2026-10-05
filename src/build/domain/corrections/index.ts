import { DataError } from "../errors";
import type { Card, LinkTarget } from "../model";

export type Correction =
  | { kind: "card-reference"; cardSlug: string; from: string; to: string; reason: string } // references[].slug を直す
  | { kind: "rule-link"; path: string; from: string; to: LinkTarget | null; reason: string }; // path は RawPage.path、from はリンクの括弧内そのまま。null はリンクを外して文字だけ残す

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
    kind: "rule-link",
    path: "game-mechanics/game-mechanics-types-of-effects/types-of-effects-continuous-effects/README.md",
    from: "../../../glossary/game-terms.md#have-gain-get-become-are",
    to: null,
    reason:
      "リンク先の節が無いので外す（game-terms.md に have・gain・get・become・are の見出しが無い）",
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
];

// card-reference の項目だけを当てる。当たらない項目は名指しして DataError
export function applyCardCorrections(cards: Card[], corrections: readonly Correction[]): Card[] {
  const out = cards.map((c) => (c.references ? { ...c, references: [...c.references] } : c));
  for (const fix of corrections) {
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
