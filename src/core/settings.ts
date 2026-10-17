import {
  AGE_MAX,
  AGE_MIN,
  ANGLES,
  BALANCES,
  BUILDS,
  CAPTURES,
  CATEGORIES,
  CLIMATES,
  COLORS,
  DETAIL_LEVELS,
  EMOTIONS,
  EYE_COLORS,
  FRAMINGS,
  FRECKLES,
  GLASSES,
  HAIR_COLORS,
  HAIR_LENGTHS,
  HAIR_STYLES,
  HAIR_TYPES,
  HEIGHTS,
  LENGTHS,
  LOCK_KEYS,
  MAKEUPS,
  MODES,
  OUTFIT_TAGS,
  POSTURES,
  PROFILES,
  RARITIES,
  RATIO_IDS,
  SEASONS,
  SERIES_THEMES,
  SHARPNESS,
  SKIN_TONES,
  STYLES,
  TIMES,
  WEATHERS,
} from './vocab.ts';
import type {
  Balance,
  Capture,
  ColorMode,
  DetailLevel,
  Length,
  LockKey,
  Mode,
  Orientation,
  Profile,
  Rarity,
  RatioId,
  SeriesTheme,
  Sharpness,
  Style,
} from './vocab.ts';
import type { ScenarioRatio } from './types.ts';

export type FieldMode = 'auto' | 'manual' | 'exclude';

export interface ChoiceControl {
  mode: FieldMode;
  values: string[];
}

export const CHOICE_KEYS = [
  'hairColor',
  'hairLength',
  'hairType',
  'hairStyle',
  'eyeColor',
  'skinTone',
  'build',
  'height',
  'makeup',
  'freckles',
  'glasses',
  'clothingStyle',
  'scene',
  'category',
  'season',
  'weather',
  'time',
  'framing',
  'angle',
  'emotion',
  'posture',
] as const;
export type ChoiceKey = (typeof CHOICE_KEYS)[number];

/** Допустимые значения для полей выбора (кроме scene — это динамический список id сцен). */
export const CHOICE_OPTIONS: Record<Exclude<ChoiceKey, 'scene'>, readonly string[]> = {
  hairColor: HAIR_COLORS,
  hairLength: HAIR_LENGTHS,
  hairType: HAIR_TYPES,
  hairStyle: HAIR_STYLES,
  eyeColor: EYE_COLORS,
  skinTone: SKIN_TONES,
  build: BUILDS,
  height: HEIGHTS,
  makeup: MAKEUPS,
  freckles: FRECKLES,
  glasses: GLASSES,
  clothingStyle: OUTFIT_TAGS,
  category: CATEGORIES,
  season: SEASONS,
  weather: WEATHERS,
  time: TIMES,
  framing: FRAMINGS,
  angle: ANGLES,
  emotion: EMOTIONS,
  posture: POSTURES,
};

export interface RatioSetting {
  mode: 'auto' | 'preset' | 'custom';
  preset: RatioId;
  custom: { w: number; h: number };
}

export interface Settings {
  version: 1;
  mode: Mode;
  seed: string;
  balance: Balance;
  age: { min: number; max: number; exact: number | null };
  backgroundPeople: boolean;
  faceRequired: boolean;
  allowSadEmotions: boolean;
  climate: 'auto' | (typeof CLIMATES)[number];
  orientation: 'auto' | 'vertical' | 'horizontal';
  ratio: RatioSetting;
  captureShares: Record<Capture, number>;
  choices: Record<ChoiceKey, ChoiceControl>;
  rarity: Record<Rarity, number>;
  style: Style;
  color: ColorMode;
  sharpness: Sharpness;
  length: Length;
  detailLevel: DetailLevel;
  spontaneity: number;
  randomness: number;
  imperfections: boolean;
  profile: Profile;
  includeNegative: boolean;
  showRussian: boolean;
  dupWindow: number;
  seriesLength: number;
  seriesTheme: SeriesTheme;
  batchCount: number;
  historyLimit: number;
  locks: LockKey[];
}

export const DEFAULT_CAPTURE_SHARES: Record<Capture, number> = {
  'selfie-arm': 28,
  'selfie-mirror': 8,
  'selfie-reflection': 4,
  'front-camera': 12,
  'tripod-timer': 6,
  'by-acquaintance': 16,
  'by-friend-walk': 12,
  candid: 14,
};

export function emptyChoices(): Record<ChoiceKey, ChoiceControl> {
  const out = {} as Record<ChoiceKey, ChoiceControl>;
  for (const k of CHOICE_KEYS) out[k] = { mode: 'auto', values: [] };
  return out;
}

export function defaultSettings(): Settings {
  return {
    version: 1,
    mode: 'new',
    seed: '',
    balance: 'balanced',
    age: { min: AGE_MIN, max: AGE_MAX, exact: null },
    backgroundPeople: true,
    faceRequired: false,
    allowSadEmotions: false,
    climate: 'auto',
    orientation: 'auto',
    ratio: { mode: 'auto', preset: '9:16', custom: { w: 7, h: 10 } },
    captureShares: { ...DEFAULT_CAPTURE_SHARES },
    choices: emptyChoices(),
    rarity: { common: 100, uncommon: 45, rare: 15 },
    style: 'smartphone',
    color: 'natural',
    sharpness: 'sharp',
    length: 'standard',
    detailLevel: 'medium',
    spontaneity: 55,
    randomness: 50,
    imperfections: true,
    profile: 'universal',
    includeNegative: true,
    showRussian: false,
    dupWindow: 50,
    seriesLength: 6,
    seriesTheme: 'auto',
    batchCount: 10,
    historyLimit: 500,
    locks: [],
  };
}

// ───────── Форматы кадра ─────────

export function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function orientationOf(w: number, h: number): Orientation {
  if (w > h * 1.02) return 'horizontal';
  if (h > w * 1.02) return 'vertical';
  return 'square';
}

export function describeRatio(w: number, h: number): ScenarioRatio {
  const g = gcd(w, h) || 1;
  const rw = w / g;
  const rh = h / g;
  return { w: rw, h: rh, label: `${rw}:${rh}`, orientation: orientationOf(rw, rh) };
}

export function ratioFromId(id: RatioId): ScenarioRatio {
  const [w, h] = id.split(':').map(Number) as [number, number];
  return { w, h, label: id, orientation: orientationOf(w, h) };
}

export const RATIO_PRESETS: readonly ScenarioRatio[] = RATIO_IDS.map(ratioFromId);

/** Допустимое пользовательское соотношение: целые 1–99, не круче 1:4 и 4:1. */
export function isValidCustomRatio(w: number, h: number): boolean {
  if (!Number.isInteger(w) || !Number.isInteger(h)) return false;
  if (w < 1 || h < 1 || w > 99 || h > 99) return false;
  const r = w / h;
  return r >= 0.25 && r <= 4;
}

/** Конкретный формат, если он задан вручную; иначе null (движок подберёт сам). */
export function fixedRatio(s: Settings): ScenarioRatio | null {
  if (s.ratio.mode === 'preset') return ratioFromId(s.ratio.preset);
  if (s.ratio.mode === 'custom' && isValidCustomRatio(s.ratio.custom.w, s.ratio.custom.h)) {
    return describeRatio(s.ratio.custom.w, s.ratio.custom.h);
  }
  return null;
}

// ───────── Нормализация и проверка ─────────

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function pickEnum<T extends string>(v: unknown, list: readonly T[], fallback: T): T {
  return typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

export interface NormalizeResult {
  settings: Settings;
  problems: string[];
}

/** Приводит произвольный объект к корректным настройкам: недопустимое заменяется значением по умолчанию. */
export function normalizeSettings(raw: unknown): NormalizeResult {
  const def = defaultSettings();
  const problems: string[] = [];
  if (!isObj(raw)) {
    if (raw !== undefined && raw !== null) problems.push('Настройки имеют неверный формат — использованы значения по умолчанию.');
    return { settings: def, problems };
  }
  const s = defaultSettings();
  const note = (cond: boolean, msg: string) => {
    if (!cond) problems.push(msg);
  };

  s.mode = pickEnum(raw.mode, MODES, def.mode);
  note(raw.mode === undefined || s.mode === raw.mode, 'Режим генерации сброшен: неизвестное значение.');
  s.seed = typeof raw.seed === 'string' ? raw.seed.trim().slice(0, 64) : '';
  s.balance = pickEnum(raw.balance, BALANCES, def.balance);

  if (isObj(raw.age)) {
    let min = clampInt(raw.age.min, AGE_MIN, AGE_MAX, AGE_MIN);
    let max = clampInt(raw.age.max, AGE_MIN, AGE_MAX, AGE_MAX);
    if (min > max) {
      problems.push('Минимальный возраст был больше максимального — значения поменяны местами.');
      [min, max] = [max, min];
    }
    s.age.min = min;
    s.age.max = max;
    s.age.exact = raw.age.exact === null || raw.age.exact === undefined ? null : clampInt(raw.age.exact, AGE_MIN, AGE_MAX, AGE_MIN);
    if (s.age.exact !== null && (typeof raw.age.exact !== 'number' || raw.age.exact !== s.age.exact)) {
      problems.push('Точный возраст приведён к диапазону 20–45.');
    }
  }

  s.backgroundPeople = bool(raw.backgroundPeople, def.backgroundPeople);
  s.faceRequired = bool(raw.faceRequired, def.faceRequired);
  s.allowSadEmotions = bool(raw.allowSadEmotions, def.allowSadEmotions);
  s.climate = pickEnum(raw.climate, ['auto', ...CLIMATES] as const, 'auto');
  s.orientation = pickEnum(raw.orientation, ['auto', 'vertical', 'horizontal'] as const, 'auto');

  if (isObj(raw.ratio)) {
    s.ratio.mode = pickEnum(raw.ratio.mode, ['auto', 'preset', 'custom'] as const, 'auto');
    s.ratio.preset = pickEnum(raw.ratio.preset, RATIO_IDS, '9:16');
    if (isObj(raw.ratio.custom)) {
      const w = clampInt(raw.ratio.custom.w, 1, 99, 7);
      const h = clampInt(raw.ratio.custom.h, 1, 99, 10);
      if (isValidCustomRatio(w, h)) s.ratio.custom = { w, h };
      else {
        problems.push('Пользовательское соотношение сторон вне допустимых пределов (1:4 … 4:1) — сброшено.');
        if (s.ratio.mode === 'custom') s.ratio.mode = 'auto';
      }
    }
    if (s.ratio.mode === 'custom' && !isValidCustomRatio(s.ratio.custom.w, s.ratio.custom.h)) s.ratio.mode = 'auto';
  }

  if (isObj(raw.captureShares)) {
    for (const c of CAPTURES) s.captureShares[c] = clampInt(raw.captureShares[c], 0, 100, def.captureShares[c]);
    if (CAPTURES.every((c) => s.captureShares[c] === 0)) {
      problems.push('Все доли типов съёмки были нулевыми — восстановлены значения по умолчанию.');
      s.captureShares = { ...DEFAULT_CAPTURE_SHARES };
    }
  }

  if (isObj(raw.choices)) {
    for (const k of CHOICE_KEYS) {
      const c = raw.choices[k];
      if (!isObj(c)) continue;
      const mode = pickEnum(c.mode, ['auto', 'manual', 'exclude'] as const, 'auto');
      const allowed = k === 'scene' ? null : (CHOICE_OPTIONS[k] as readonly string[]);
      const values = Array.isArray(c.values)
        ? c.values.filter((v): v is string => typeof v === 'string' && (allowed ? allowed.includes(v) : /^[a-z0-9-]+$/.test(v))).slice(0, 400)
        : [];
      s.choices[k] = { mode: values.length === 0 && mode !== 'auto' ? 'auto' : mode, values: [...new Set(values)] };
    }
  }

  if (isObj(raw.rarity)) {
    for (const r of RARITIES) s.rarity[r] = clampInt(raw.rarity[r], 0, 100, def.rarity[r]);
    if (RARITIES.every((r) => s.rarity[r] === 0)) s.rarity = { ...def.rarity };
  }

  s.style = pickEnum(raw.style, STYLES, def.style);
  s.color = pickEnum(raw.color, COLORS, def.color);
  s.sharpness = pickEnum(raw.sharpness, SHARPNESS, def.sharpness);
  s.length = pickEnum(raw.length, LENGTHS, def.length);
  s.detailLevel = pickEnum(raw.detailLevel, DETAIL_LEVELS, def.detailLevel);
  s.spontaneity = clampInt(raw.spontaneity, 0, 100, def.spontaneity);
  s.randomness = clampInt(raw.randomness, 0, 100, def.randomness);
  s.imperfections = bool(raw.imperfections, def.imperfections);
  s.profile = pickEnum(raw.profile, PROFILES, def.profile);
  s.includeNegative = bool(raw.includeNegative, def.includeNegative);
  s.showRussian = bool(raw.showRussian, def.showRussian);
  s.dupWindow = clampInt(raw.dupWindow, 0, 200, def.dupWindow);
  s.seriesLength = clampInt(raw.seriesLength, 2, 24, def.seriesLength);
  s.seriesTheme = pickEnum(raw.seriesTheme, SERIES_THEMES, def.seriesTheme);
  s.batchCount = clampInt(raw.batchCount, 1, 100, def.batchCount);
  s.historyLimit = clampInt(raw.historyLimit, 20, 2000, def.historyLimit);
  s.locks = Array.isArray(raw.locks)
    ? [...new Set(raw.locks.filter((l): l is LockKey => typeof l === 'string' && (LOCK_KEYS as readonly string[]).includes(l)))]
    : [];
  return { settings: s, problems };
}

export function cloneSettings(s: Settings): Settings {
  return normalizeSettings(JSON.parse(JSON.stringify(s))).settings;
}
