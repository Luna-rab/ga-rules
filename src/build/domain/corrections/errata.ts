import type { Correction } from "./index";

// API の効果テキスト（effect_raw）に ERRATA が当たっていないカードを、ERRATA の右側の文面に直す。
// ERRATA の文面は断片で（your -> their owner's）、句読点や表記（’、pay 2、power）も効果テキストと揃わないので、
// 置き換える箇所と文面はカードごとに効果テキストを読んで決めている
function errata(citeId: string, from: string, to: string, note?: string): Correction {
  const cardSlug = citeId.slice(0, citeId.indexOf("#"));
  const reason = `ERRATA ${citeId} が効果テキストに当たっていない${note ? `。${note}` : ""}`;
  return { kind: "card-text", cardSlug, from, to, reason };
}

// 2026-08-16 の ERRATA は「武器を攻撃に使う」を「武器を wield する」に言い換えた。同じ注釈文を持つカードが多い
const RANGED_WEAPON_CARDS = [
  "framework-sidearm#ruling:2026-08-16:1",
  "loaded-thoughts#ruling:2026-08-16:1",
  "prototype-pistol#ruling:2026-08-16:1",
  "quickdraw-piercer#ruling:2026-08-16:1",
  "blastshot-pump#ruling:2026-08-16:1",
  "intricate-longbow#ruling:2026-08-16:1",
  "seekers-aetherwing#ruling:2026-08-16:1",
  "trivariate-dream#ruling:2026-08-16:1",
];
const LOAD_CARDS = [
  "focusing-round#ruling:2026-08-16:1",
  "force-load#ruling:2026-08-16:1",
  "incendiary-shot#ruling:2026-08-16:1",
  "plated-bullet#ruling:2026-08-16:1",
  "savage-arrow#ruling:2026-08-16:1",
  "steel-slug#ruling:2026-08-16:1",
];
const COMMANDED_WILL_CARDS = [
  "pawn-piece#ruling:2026-08-16:1",
  "queen-piece#ruling:2026-08-16:1",
  "rowland-schwartz-knight#ruling:2026-08-16:1",
  "weiss-knight#ruling:2026-08-16:1",
  "schwartz-castler#ruling:2026-08-16:1",
];
const ADDITIONAL_COST_CARDS = [
  "archon-broadsword#ruling:2026-08-16:1",
  "bulwark-sword#ruling:2026-08-16:1",
  "defenders-maul#ruling:2026-08-16:1",
  "oathbreakers-justice#ruling:2026-08-16:1",
  "tideholder-claymore#ruling:2026-08-16:1",
];

export const ERRATA_CORRECTIONS: readonly Correction[] = [
  // 注釈文の can’t / can't はカードによって違うので、引用符をまたがない 2 か所に分けて直す
  ...RANGED_WEAPON_CARDS.flatMap((id) => [
    errata(id, "loaded to use for an attack and can", "loaded to be wielded and can"),
    errata(id, "be used with an attack card", "be wielded with an attack card"),
  ]),
  errata(
    "hoarfrost-spine#ruling:2026-08-16:1",
    "loaded to use for an attack and can",
    "loaded to wield and can",
  ),
  errata(
    "hoarfrost-spine#ruling:2026-08-16:1",
    "be used with an attack card",
    "be wielded with an attack card",
  ),
  errata(
    "contraband-revolver#ruling:2026-08-16:1",
    "loaded to use for an attack and can",
    "loaded to be wielded for an attack and can",
  ),
  errata(
    "contraband-revolver#ruling:2026-08-16:1",
    "be used with an attack card",
    "be wielded with an attack card",
  ),
  ...LOAD_CARDS.map((id) =>
    errata(id, "As a weapon is used for an attack,", "As a weapon is wielded,"),
  ),
  ...COMMANDED_WILL_CARDS.map((id) =>
    errata(id, "attacking using a Command card", "attacking with a Command card"),
  ),
  ...ADDITIONAL_COST_CARDS.map((id) =>
    errata(
      id,
      "additional cost to use this weapon for an attack",
      "additional cost to wield this weapon",
    ),
  ),
  errata(
    "aetherial-projection#ruling:2026-08-16:1",
    "can attack using this weapon",
    "can wield this weapon",
  ),
  errata("blastshot-pump#ruling:2026-08-16:2", "by an attack using", "by an attacker wielding"),
  errata(
    "blightheart-penitent#ruling:2026-08-16:1",
    "REST: If you control",
    "REST: Activate this ability only if you control",
    "ERRATA の右側は you が抜けている（only if control）ので補う",
  ),
  errata(
    "calamity-cannon#ruling:2026-08-16:1",
    "first attack using a Gun weapon",
    "first attack wielding a Gun weapon",
  ),
  errata(
    "camil-basked-abundance#ruling:2026-08-16:1",
    "linked to Camil into your memory",
    "linked to Camil into their owner's memory",
    "your は 3 か所にある。リンクしていたアイテムは相手のものでもありうるので、On Leave の戻し先を直す",
  ),
  errata(
    "cardinal-of-divine-rite#ruling:2026-03-31:1",
    "Angel cards and objects",
    "Angel cards and Angel objects",
  ),
  errata(
    "carnwennan-shrouded-edge#ruling:2026-08-16:1",
    "Attacks using Carnwennan",
    "Attackers wielding Carnwennan",
  ),
  errata(
    "claimed-from-beyond#ruling:2025-11-24:1",
    "if one of its types matches one of the types among",
    "if one of its card types matches one of the card types among",
    "types は 2 か所にあり、注釈文が挙げるのはどちらもカードの型（ally・domain など）なので両方直す",
  ),
  errata(
    "dominating-strike#ruling:2026-08-16:1",
    "Weapons can't be used for this attack.",
    "Weapons can't be wielded for this attack.",
  ),
  errata(
    "effluve-guard#ruling:2025-07-23:1",
    "allies named Vacuous Servants you control",
    "allies named Vacuous Servant you control",
  ),
  errata(
    "feu-awakening#ruling:2025-12-04:1",
    "players can't gain opportunity",
    "players can't have opportunity",
  ),
  errata(
    "field-of-ranks-and-files#ruling:2025-11-30:1",
    "The first time a Chessman ally enters the field under your control during each of your turns, that ally gets",
    "Whenever one or more Chessman allies enter the field under your control for the first time during each of your turns, choose one of them and that ally gets",
  ),
  errata(
    "galahad-court-knight#ruling:2026-08-16:1",
    "can attack using Sword weapons",
    "can wield Sword weapons",
  ),
  errata(
    "hemorrhaged-intimidation#ruling:2026-03-31:1",
    "The next card your opponent activates",
    "The next card that opponent activates",
  ),
  errata(
    "huaji-of-heavens-rise#ruling:2026-08-16:1",
    "can attack using this weapon",
    "can wield this weapon",
  ),
  {
    kind: "card-text",
    cardSlug: "huaji-of-abyssal-fall",
    from: "can attack using this weapon",
    to: "can wield this weapon",
    reason:
      "ERRATA huaji-of-heavens-rise#ruling:2026-08-16:1 が裏面の効果テキストに当たっていない。裏面にも表と同じ文がある",
  },
  errata(
    "impact-hammer#ruling:2026-08-16:1",
    "Whenever a unit uses this weapon for an attack,",
    "Whenever a unit wields this weapon,",
  ),
  errata(
    "jabberwocky-calamitys-call#ruling:2026-02-17:1",
    "As long as a player doesn't control",
    "As long as no player controls",
  ),
  errata("lacunas-grasp#ruling:2025-06-27:2", "gets +XPOWER.", "gets +X POWER until end of turn."),
  errata(
    "lakereaving-chill#ruling:2026-08-16:1",
    "can't be used for an attack.",
    "can't be wielded.",
  ),
  errata("lost-providence#ruling:2025-11-24:1", "If you do it enters", "If you do, it enters"),
  errata(
    "luminous-quartz#ruling:2026-08-16:1",
    "can't be used for an attack.",
    "can't be wielded.",
  ),
  errata(
    "mechanized-smasher#ruling:2026-08-16:1",
    "can’t be used with attack cards",
    "can’t be wielded with attack cards",
  ),
  errata(
    "mechanized-smasher#ruling:2026-08-16:2",
    "additional cost to use Mechanized Smasher for an attack",
    "additional cost to wield Mechanized Smasher",
  ),
  errata(
    "piercing-aetherfuel#ruling:2026-08-16:1",
    "next attack this turn using an Aetherwing weapon",
    "next attack this turn wielding an Aetherwing weapon",
  ),
  errata(
    "radiant-origin-of-warrior#ruling:2026-08-16:1",
    "your champion attacks using a weapon",
    "your champion wields a weapon",
  ),
  errata(
    "seekers-rifle#ruling:2026-08-16:1",
    "Attacks using this weapon",
    "Attacks while wielding this weapon",
  ),
  errata(
    "servants-obligation#ruling:2025-07-22:1",
    "hasn't been attacked this turn",
    "hasn't been dealt combat damage this turn",
  ),
  errata(
    "shadows-claw#ruling:2026-08-16:1",
    "can attack using Shadow's Claw",
    "can wield Shadow's Claw",
  ),
  errata(
    "shadows-twin#ruling:2026-08-16:1",
    "Whenever an attack using this weapon",
    "Whenever a unit wielding this weapon",
  ),
  errata(
    "shardforged-blade#ruling:2026-08-16:1",
    "as long the attacker is attacking",
    "as long as the wielder is attacking",
    "ERRATA shardforged-blade#ruling:2025-11-24:1（As long the -> As long as the）も同じ箇所なので一緒に直す",
  ),
  errata(
    "siphoning-stab#ruling:2026-08-16:1",
    "the attacker is attacking using a Polearm weapon",
    "the attacker is wielding a Polearm weapon",
  ),
  errata(
    "spirit-blade-infusion#ruling:2025-12-02:1",
    'POWER and "On Champion Hit:',
    'POWER and gains "On Champion Hit:',
  ),
  errata(
    "tera-sight#ruling:2024-06-17:1",
    "return a preserved card to your hand.",
    "return a preserved card to its owner's hand.",
  ),
  errata(
    "invoke-dominance#ruling:2024-06-17:1",
    "return a preserved card to your hand.",
    "return a preserved card to its owner's hand.",
  ),
  errata("total-whiteout#ruling:2026-08-16:1", "can't be used for an attack.", "can't be wielded."),
  errata(
    "vanitas-convergent-ruin#ruling:2026-08-16:1",
    "next attack without a weapon",
    "next attack without wielding a weapon",
  ),
  errata("alice-whims-monarch#ruling:2025-11-24:1", "Pawn Piece Token", "Pawn Piece token"),
];
