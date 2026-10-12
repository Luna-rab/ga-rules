import type { Attributes } from "./model";

// search_cards が返す最大の件数。総件数がこれを超えたら、条件を足すよう促す
export const SEARCH_LIMIT = 20;

export type SearchCardsArgs = {
  text?: string;
  type?: string;
  subtype?: string;
  class?: string;
  element?: string;
  cost_type?: string;
  speed?: string;
  legal_in?: string;
  banned_in?: string;
  cost_min?: number;
  cost_max?: number;
  level_min?: number;
  level_max?: number;
  power_min?: number;
  power_max?: number;
  life_min?: number;
  life_max?: number;
  durability_min?: number;
  durability_max?: number;
};

export const COST_TYPES = ["reserve", "memory", "none"];
export const SPEEDS = ["fast", "slow"];
export const FORMATS = ["STANDARD", "PANTHEON", "DRAFT"];

export const RANGE_FIELDS = ["cost", "level", "power", "life", "durability"] as const;
export type RangeField = (typeof RANGE_FIELDS)[number];
export type AttributeKey = "type" | "subtype" | "class" | "element";

// 照合の済んだ検索条件。値は DB にある綴りに直してある。
export type CardQuery = {
  // 名前か効果テキストに全語を含むカードが当たる
  words: string[] | null;
  attributes: { key: AttributeKey; value: string }[];
  costType: string | null;
  speed: boolean | null;
  legalIn: string | null;
  bannedIn: string | null;
  ranges: { field: RangeField; min: number | null; max: number | null }[];
};

export type ParsedCardQuery = { ok: true; query: CardQuery } | { ok: false; message: string };

const ATTRIBUTE_LISTS: [AttributeKey, keyof Attributes][] = [
  ["type", "types"],
  ["subtype", "subtypes"],
  ["class", "classes"],
  ["element", "elements"],
];

function pick(values: string[], given: string): string | null {
  const lower = given.toLowerCase();
  return values.find((v) => v.toLowerCase() === lower) ?? null;
}

// 文字と数字の語に分ける。記号は検索の式に渡さない。語が無ければ null
function textWords(text: string): string[] | null {
  return text.match(/[\p{L}\p{N}]+/gu);
}

// search_cards の引数を確かめる。呼び方の誤りは直し方つきの message で返す。
export function parseCardQuery(args: SearchCardsArgs, attrs: Attributes): ParsedCardQuery {
  if (Object.values(args).every((v) => v === undefined)) {
    return {
      ok: false,
      message:
        "No search conditions given. Specify at least one condition (text, type, subtype, class, element, cost_type, speed, legal_in, banned_in, or a _min/_max range).",
    };
  }

  const errors: string[] = [];
  const invalid = (name: string, values: string[]) =>
    errors.push(`Invalid ${name}. Valid values: ${values.join(", ")}`);

  let words: string[] | null = null;
  if (args.text !== undefined) {
    words = textWords(args.text);
    if (words === null) {
      errors.push("text has no letters or digits to search for. Give at least one word.");
    }
  }

  const attributes: CardQuery["attributes"] = [];
  for (const [key, list] of ATTRIBUTE_LISTS) {
    const given = args[key];
    if (given === undefined) continue;
    const value = pick(attrs[list], given);
    if (value === null) invalid(key, attrs[list]);
    else attributes.push({ key, value });
  }

  let costType: string | null = null;
  if (args.cost_type !== undefined) {
    costType = pick(COST_TYPES, args.cost_type);
    if (costType === null) invalid("cost_type", COST_TYPES);
  }
  let speed: boolean | null = null;
  if (args.speed !== undefined) {
    const s = pick(SPEEDS, args.speed);
    if (s === null) invalid("speed", SPEEDS);
    else speed = s === "fast";
  }
  let legalIn: string | null = null;
  if (args.legal_in !== undefined) {
    legalIn = pick(FORMATS, args.legal_in);
    if (legalIn === null) invalid("legal_in", FORMATS);
  }
  let bannedIn: string | null = null;
  if (args.banned_in !== undefined) {
    bannedIn = pick(FORMATS, args.banned_in);
    if (bannedIn === null) invalid("banned_in", FORMATS);
  }

  const ranges: CardQuery["ranges"] = [];
  for (const field of RANGE_FIELDS) {
    const min = args[`${field}_min`] ?? null;
    const max = args[`${field}_max`] ?? null;
    if (min !== null && max !== null && min > max) {
      errors.push(`${field}_min (${min}) is greater than ${field}_max (${max}). Give min <= max.`);
    }
    if (min !== null || max !== null) ranges.push({ field, min, max });
  }

  if (errors.length > 0) return { ok: false, message: errors.join("\n") };
  return {
    ok: true,
    query: { words, attributes, costType, speed, legalIn, bannedIn, ranges },
  };
}
