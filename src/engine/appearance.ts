import { AGE_MAX, AGE_MIN } from '../core/vocab.ts';
import type { Subject } from '../core/types.ts';
import type {
  Build,
  EyeColor,
  Freckles,
  Glasses,
  HairColor,
  HairLength,
  HairStyle,
  HairType,
  Height,
  Makeup,
  OutfitTag,
  SkinTone,
  TimeOfDay,
  Weather,
} from '../core/vocab.ts';
import { FEATURES } from '../data/appearance.ts';
import type { Resolved } from './context.ts';
import type { Rng } from './rng.ts';

export interface SubjectKeep {
  age?: number;
  hair?: Pick<Subject, 'hairColor' | 'hairLength' | 'hairType' | 'hairStyle'>;
  eyes?: EyeColor;
  skin?: SkinTone;
  build?: { build: Build; height: Height };
  face?: Pick<Subject, 'makeup' | 'freckles' | 'glasses' | 'features'>;
}

export interface CoreSubject {
  age: number;
  hairColor: HairColor;
  hairLength: HairLength;
  hairType: HairType;
  eyeColor: EyeColor;
  skinTone: SkinTone;
  build: Build;
  height: Height;
  freckles: Freckles;
  clearGlasses: boolean;
  features: string[];
}

function pickFrom<T extends string>(R: Resolved, rng: Rng, list: readonly T[], w: (x: T) => number): T {
  return rng.weighted(list, (x) => R.temper(w(x))) ?? rng.pick(list);
}

export function ageWeight(a: number): number {
  if (a >= 25 && a <= 33) return 3;
  if (a <= 24) return 1.3;
  if (a <= 39) return 1.6;
  return 1;
}

export function sampleAge(R: Resolved, rng: Rng): number {
  const min = Math.max(AGE_MIN, R.age.min);
  const max = Math.min(AGE_MAX, R.age.max);
  const ages: number[] = [];
  for (let a = min; a <= max; a++) ages.push(a);
  if (ages.length === 0) return Math.min(AGE_MAX, Math.max(AGE_MIN, min));
  return rng.weighted(ages, (a) => ageWeight(a)) ?? ages[0]!;
}

const HAIR_COLOR_W = (age: number): Record<HairColor, number> => ({
  black: 8,
  'dark-brown': 14,
  brown: 14,
  chestnut: 10,
  auburn: 4,
  'copper-red': 3,
  'dark-blonde': 9,
  'golden-blonde': 6,
  'ash-blonde': 5,
  'salt-and-pepper': age >= 38 ? 4 * Math.min(1, (age - 37) / 8) : 0,
  'silver-gray': age >= 42 ? 1.5 : 0,
});

const HAIR_STYLES_BY_LENGTH: Record<HairLength, readonly HairStyle[]> = {
  short: ['loose', 'tucked', 'bangs', 'short-tousled'],
  chin: ['loose', 'tucked', 'bangs', 'half-up', 'short-tousled'],
  shoulder: ['loose', 'tucked', 'bangs', 'half-up', 'ponytail', 'low-bun', 'messy-bun', 'braid'],
  long: ['loose', 'tucked', 'bangs', 'half-up', 'ponytail', 'low-bun', 'messy-bun', 'braid'],
};

export function hairStylesFor(length: HairLength): readonly HairStyle[] {
  return HAIR_STYLES_BY_LENGTH[length];
}

const TIED: readonly HairStyle[] = ['ponytail', 'low-bun', 'messy-bun', 'braid', 'half-up'];
const ACTIVE_TAGS: readonly OutfitTag[] = ['sport', 'dance', 'work', 'swim', 'hiking', 'ski'];

function sampleFeatures(rng: Rng, age: number): string[] {
  const count = rng.weighted([0, 1, 2], (n) => (n === 0 ? 35 : n === 1 ? 45 : 20)) ?? 0;
  const pool = FEATURES.filter((f) => (f.minAge ?? 0) <= age);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const f = rng.weighted(pool, (x) => (out.includes(x.id) ? 0 : x.weight));
    if (f) out.push(f.id);
  }
  return out;
}

/** Внешность, не зависящая от сцены. Если задан персонаж — берётся из него. */
export function sampleCore(R: Resolved, rng: Rng, keep: SubjectKeep, base: Subject | null): CoreSubject {
  if (base) {
    return {
      age: base.age,
      hairColor: base.hairColor,
      hairLength: base.hairLength,
      hairType: base.hairType,
      eyeColor: base.eyeColor,
      skinTone: base.skinTone,
      build: base.build,
      height: base.height,
      freckles: base.freckles,
      clearGlasses: base.glasses === 'clear',
      features: [...base.features],
    };
  }
  const age = keep.age ?? sampleAge(R, rng.fork('age'));
  const hw = HAIR_COLOR_W(age);
  const hairColor = keep.hair?.hairColor ?? pickFrom(R, rng.fork('hairColor'), R.app.hairColor, (c) => hw[c]);
  const hairLength = keep.hair?.hairLength ?? pickFrom(R, rng.fork('hairLength'), R.app.hairLength, (l) => ({ short: 2.5, chin: 3, shoulder: 4, long: 4 })[l]);
  const hairType = keep.hair?.hairType ?? pickFrom(R, rng.fork('hairType'), R.app.hairType, (t) => ({ straight: 5, wavy: 4, curly: 2.5, coily: 1.2 })[t]);
  const eyeColor = keep.eyes ?? pickFrom(R, rng.fork('eyes'), R.app.eyeColor, (c) => ({ 'dark-brown': 9, brown: 12, hazel: 6, green: 3, blue: 4, gray: 2.5 })[c]);
  const skinTone = keep.skin ?? pickFrom(R, rng.fork('skin'), R.app.skinTone, (c) => ({ fair: 5, light: 8, medium: 8, olive: 6, tan: 5, brown: 5, 'deep-brown': 3.5 })[c]);
  const build = keep.build?.build ?? pickFrom(R, rng.fork('build'), R.app.build, (b) => ({ slim: 5, average: 7, athletic: 4, 'full-figured': 3, sturdy: 2.5, 'plus-size': 2.5 })[b]);
  const height = keep.build?.height ?? pickFrom(R, rng.fork('height'), R.app.height, (h) => ({ short: 3, average: 6, tall: 3 })[h]);
  const freckles = keep.face?.freckles ?? pickFrom(R, rng.fork('freckles'), R.app.freckles, (f) => ({ none: 7, light: 2.5, pronounced: 1.2 })[f]);
  const glassesAllowed = R.app.glasses.filter((g) => g !== 'sunglasses');
  let clearGlasses = false;
  if (keep.face) clearGlasses = keep.face.glasses === 'clear';
  else if (glassesAllowed.length) {
    const g = pickFrom(R, rng.fork('glasses'), glassesAllowed, (x) => (x === 'none' ? 8 : 1.6));
    clearGlasses = g === 'clear';
  }
  const features = keep.face?.features ? [...keep.face.features] : sampleFeatures(rng.fork('features'), age);
  return { age, hairColor, hairLength, hairType, eyeColor, skinTone, build, height, freckles, clearGlasses, features };
}

export interface SubjectContext {
  tags: readonly OutfitTag[];
  time: TimeOfDay;
  weather: Weather | null;
  outdoors: boolean;
}

export function sunglassesPlausible(c: SubjectContext): boolean {
  if (!c.outdoors) return false;
  if (c.time !== 'morning' && c.time !== 'day' && c.time !== 'golden-hour') return false;
  return c.weather === 'clear' || c.weather === 'partly-cloudy' || c.weather === 'windy' || c.weather === 'heat' || c.weather === 'frost';
}

/** Атрибуты, зависящие от контекста сцены: причёска, макияж, солнцезащитные очки. */
export function finishSubject(R: Resolved, rng: Rng, core: CoreSubject, ctx: SubjectContext, keep: SubjectKeep, base: Subject | null, notes: string[]): Subject {
  const styles = hairStylesFor(core.hairLength);
  let hairStyle: HairStyle;
  if (keep.hair) {
    hairStyle = keep.hair.hairStyle;
  } else {
    const active = ctx.tags.some((t) => ACTIVE_TAGS.includes(t));
    const allowed = R.app.hairStyle.filter((h) => styles.includes(h));
    const list = allowed.length ? allowed : [...styles];
    const bias = base && rng.fork('keepStyle').chance(0.6) && list.includes(base.hairStyle) ? base.hairStyle : null;
    hairStyle =
      bias ??
      pickFrom(R, rng.fork('hairStyle'), list, (h) => {
        const w = { loose: 5, tucked: 1.5, bangs: 1.2, 'half-up': 2, ponytail: 3, 'low-bun': 1.5, 'messy-bun': 1.5, braid: 1.2, 'short-tousled': 4 }[h];
        return TIED.includes(h) && active ? w * 2.5 : w;
      });
  }

  let makeup: Makeup;
  if (keep.face) {
    makeup = keep.face.makeup;
  } else {
    const dressy = ctx.tags.includes('evening') || ((ctx.time === 'evening' || ctx.time === 'night') && ctx.tags.includes('smart'));
    const active = ctx.tags.some((t) => ACTIVE_TAGS.includes(t));
    const realism = R.balance === 'realism' ? 1.3 : 1;
    const base0 = base && rng.fork('keepMakeup').chance(0.6) && R.app.makeup.includes(base.makeup) ? base.makeup : null;
    makeup =
      base0 ??
      pickFrom(R, rng.fork('makeup'), R.app.makeup, (m) => {
        if (active) return { none: 4, minimal: 3, everyday: 0.3, evening: 0 }[m];
        if (dressy) return { none: 0.8, minimal: 2, everyday: 3, evening: 3 }[m];
        return { none: 3 * realism, minimal: 5 * realism, everyday: 3, evening: 0.15 }[m];
      });
  }

  let glasses: Glasses = core.clearGlasses ? 'clear' : 'none';
  const wantsSun = R.app.glasses.includes('sunglasses');
  if (keep.face) {
    // Закреплённое лицо: очки сами не появляются; солнцезащитные остаются, пока уместны.
    if (keep.face.glasses === 'sunglasses') {
      if (sunglassesPlausible(ctx)) glasses = 'sunglasses';
      else notes.push('Солнцезащитные очки сняты: в этой сцене они неуместны.');
    }
  } else if (wantsSun && !core.clearGlasses && sunglassesPlausible(ctx)) {
    const onlySun = R.app.glasses.every((g) => g === 'sunglasses');
    if (onlySun || rng.fork('sunglasses').chance(ctx.weather === 'heat' || ctx.tags.includes('beach') ? 0.3 : 0.14)) glasses = 'sunglasses';
  }
  if (R.app.glasses.length === 1 && R.app.glasses[0] === 'sunglasses' && glasses !== 'sunglasses' && !keep.face && !base) {
    notes.push('Солнцезащитные очки выбраны вручную, но в этой сцене неуместны — очков нет.');
  }

  return {
    age: core.age,
    hairColor: core.hairColor,
    hairLength: core.hairLength,
    hairType: core.hairType,
    hairStyle,
    eyeColor: core.eyeColor,
    skinTone: core.skinTone,
    build: core.build,
    height: core.height,
    makeup,
    freckles: core.freckles,
    glasses,
    features: core.features,
  };
}
