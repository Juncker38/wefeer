import type { Env, OutfitTag, Season, TimeOfDay, Weather } from '../core/vocab.ts';

export interface AccessoryCtx {
  season: Season;
  weather: Weather | null;
  time: TimeOfDay;
  env: Env;
  dress: 'in' | 'out';
  need: [number, number];
  tags: readonly OutfitTag[];
  outfitEn: string;
  outfitHood: boolean;
  outfitRainwear: boolean;
  /** Дневной свет и ясное небо. */
  sunny: boolean;
  outdoors: boolean;
}

export interface AccessoryDef {
  id: string;
  en: string;
  ru: string;
  /** Сколько рук занимает аксессуар. */
  hands: 0 | 1;
  /** 0 — не подходит. */
  weight: (c: AccessoryCtx) => number;
  excludes?: readonly string[];
}

const has = (re: RegExp, s: string): boolean => re.test(s);
const anyTag = (c: AccessoryCtx, ...t: OutfitTag[]): boolean => t.some((x) => c.tags.includes(x));
const swimOnly = (c: AccessoryCtx): boolean => c.tags.every((t) => t === 'swim' || t === 'beach' || t === 'sport' || t === 'dance') && anyTag(c, 'swim');
const HEADWEAR = /\b(hat|beanie|cap|helmet|hood|balaclava|headband)\b/i;

export const ACCESSORIES: readonly AccessoryDef[] = [
  {
    id: 'sun-hat',
    en: 'a wide-brimmed straw sun hat',
    ru: 'соломенная шляпа с широкими полями',
    hands: 0,
    excludes: ['cap', 'beanie', 'hood-up'],
    weight: (c) => (c.outdoors && c.sunny && c.need[1] <= 2 && !has(HEADWEAR, c.outfitEn) ? (anyTag(c, 'beach') ? 2.6 : 0.7) : 0),
  },
  {
    id: 'cap',
    en: 'a plain baseball cap',
    ru: 'простая бейсболка',
    hands: 0,
    excludes: ['sun-hat', 'beanie', 'hood-up'],
    weight: (c) => (c.outdoors && c.time !== 'night' && c.need[0] <= 3 && anyTag(c, 'sport', 'hiking', 'travel', 'casual') && !has(HEADWEAR, c.outfitEn) && !swimOnly(c) ? 0.8 : 0),
  },
  {
    id: 'beanie',
    en: 'a knitted beanie',
    ru: 'вязаная шапка',
    hands: 0,
    excludes: ['sun-hat', 'cap', 'hood-up'],
    weight: (c) => (c.outdoors && c.need[0] >= 3 && !has(HEADWEAR, c.outfitEn) ? (c.need[0] >= 4 ? 2.4 : 1) : 0),
  },
  {
    id: 'scarf',
    en: 'a soft wool scarf',
    ru: 'мягкий шерстяной шарф',
    hands: 0,
    weight: (c) => (c.outdoors && c.need[1] >= 3 && !has(/scarf|snood|neck/i, c.outfitEn) && !anyTag(c, 'swim', 'ski') ? (c.need[0] >= 4 ? 2 : 1) : 0),
  },
  {
    id: 'gloves',
    en: 'warm gloves',
    ru: 'тёплые перчатки',
    hands: 0,
    weight: (c) => (c.outdoors && c.need[0] >= 4 && !has(/glove|mitten/i, c.outfitEn) ? 2 : 0),
  },
  {
    id: 'umbrella',
    en: 'a compact umbrella held overhead',
    ru: 'компактный зонт над головой',
    hands: 1,
    excludes: ['hood-up'],
    weight: (c) => (c.weather === 'rain' && c.dress === 'out' && c.env === 'outdoor' ? (c.outfitRainwear && c.outfitHood ? 1.2 : 3.2) : 0),
  },
  {
    id: 'hood-up',
    en: 'the hood of her jacket pulled up',
    ru: 'капюшон куртки поднят',
    hands: 0,
    excludes: ['umbrella', 'sun-hat', 'cap', 'beanie'],
    weight: (c) => {
      if (!c.outfitHood || !c.outdoors) return 0;
      if (c.weather === 'rain') return 2.6;
      if (c.weather === 'snow') return 1.4;
      if (c.weather === 'windy') return 0.8;
      return 0;
    },
  },
  {
    id: 'backpack',
    en: 'a worn canvas backpack on her shoulders',
    ru: 'потёртый тканевый рюкзак за плечами',
    hands: 0,
    excludes: ['tote-bag', 'crossbody-bag'],
    weight: (c) => (swimOnly(c) || anyTag(c, 'evening', 'dance', 'ski') ? 0 : anyTag(c, 'hiking', 'travel') ? 1.8 : anyTag(c, 'casual', 'sport') ? 0.5 : 0),
  },
  {
    id: 'tote-bag',
    en: 'a canvas tote bag over one shoulder',
    ru: 'тканевая сумка-шоппер на плече',
    hands: 0,
    excludes: ['backpack', 'crossbody-bag'],
    weight: (c) => (anyTag(c, 'casual', 'smart') && !swimOnly(c) ? 0.8 : 0),
  },
  {
    id: 'crossbody-bag',
    en: 'a small crossbody bag',
    ru: 'небольшая сумка через плечо',
    hands: 0,
    excludes: ['backpack', 'tote-bag'],
    weight: (c) => (anyTag(c, 'casual', 'smart', 'evening', 'travel') && !swimOnly(c) ? 0.8 : 0),
  },
  {
    id: 'earbuds',
    en: 'wired earbuds hanging around her neck',
    ru: 'проводные наушники на шее',
    hands: 0,
    weight: (c) => (anyTag(c, 'casual', 'sport', 'travel') && (c.outdoors || c.dress === 'out') && !swimOnly(c) ? 0.5 : 0),
  },
  {
    id: 'wristwatch',
    en: 'a simple wristwatch',
    ru: 'простые наручные часы',
    hands: 0,
    weight: (c) => (swimOnly(c) ? 0 : 0.45),
  },
  {
    id: 'earrings',
    en: 'small hoop earrings',
    ru: 'небольшие серьги-кольца',
    hands: 0,
    weight: (c) => (anyTag(c, 'smart', 'evening', 'casual') && !anyTag(c, 'sport', 'swim', 'ski') ? 0.5 : 0),
  },
  {
    id: 'necklace',
    en: 'a thin chain necklace',
    ru: 'тонкая цепочка на шее',
    hands: 0,
    weight: (c) => (anyTag(c, 'smart', 'evening', 'casual') && !anyTag(c, 'sport', 'swim', 'ski') ? 0.4 : 0),
  },
];

export const ACCESSORY_BY_ID: ReadonlyMap<string, AccessoryDef> = new Map(ACCESSORIES.map((a) => [a.id, a]));
