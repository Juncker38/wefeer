import type { ScenarioRatio } from '../core/types.ts';
import { defaultSettings, fixedRatio, DEFAULT_CAPTURE_SHARES, emptyChoices } from '../core/settings.ts';
import type { ChoiceControl, Settings } from '../core/settings.ts';
import {
  ANGLES,
  BUILDS,
  CAPTURES,
  CATEGORIES,
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
  MAKEUPS,
  OUTFIT_TAGS,
  POSTURES,
  SEASONS,
  SKIN_TONES,
  TIMES,
  WEATHERS,
} from '../core/vocab.ts';
import type {
  Angle,
  Balance,
  Build,
  Capture,
  Category,
  Climate,
  DetailLevel,
  Emotion,
  EyeColor,
  Framing,
  Freckles,
  Glasses,
  HairColor,
  HairLength,
  HairStyle,
  HairType,
  Height,
  LockKey,
  Makeup,
  OutfitTag,
  Posture,
  Rarity,
  Season,
  SkinTone,
  TimeOfDay,
  Weather,
} from '../core/vocab.ts';
import { normalizeShares } from './rng.ts';

export interface Allowed<T> {
  list: T[];
  /** Выбор пользователя оказался пустым — использован полный набор. */
  relaxed: boolean;
}

export function allowedOf<T extends string>(c: ChoiceControl | undefined, all: readonly T[]): Allowed<T> {
  if (!c || c.mode === 'auto') return { list: [...all], relaxed: false };
  const vals = new Set(c.values);
  const list = all.filter((x) => (c.mode === 'manual' ? vals.has(x) : !vals.has(x)));
  return list.length ? { list, relaxed: false } : { list: [...all], relaxed: true };
}

export interface Resolved {
  settings: Settings;
  chaos: boolean;
  climate: Climate;
  age: { min: number; max: number; exact: number | null };
  faceRequired: boolean;
  allowSad: boolean;
  crowdOk: boolean;
  shares: Record<Capture, number>;
  season: Season[];
  weather: Weather[];
  time: TimeOfDay[];
  category: Category[];
  framing: Framing[];
  angle: Angle[];
  emotion: Emotion[];
  posture: Posture[];
  clothing: OutfitTag[] | null;
  sceneManual: Set<string> | null;
  sceneExclude: Set<string>;
  app: {
    hairColor: HairColor[];
    hairLength: HairLength[];
    hairType: HairType[];
    hairStyle: HairStyle[];
    eyeColor: EyeColor[];
    skinTone: SkinTone[];
    build: Build[];
    height: Height[];
    makeup: Makeup[];
    freckles: Freckles[];
    glasses: Glasses[];
  };
  ratio: ScenarioRatio | null;
  orientation: 'auto' | 'vertical' | 'horizontal';
  rarityW: Record<Rarity, number>;
  look: { style: Settings['style']; color: Settings['color']; sharpness: Settings['sharpness'] };
  spontaneity: number;
  randomness: number;
  detailLevel: DetailLevel;
  imperfections: boolean;
  locks: Set<LockKey>;
  balance: Balance;
  dupWindow: number;
  dupThreshold: number;
  maxAttempts: number;
  temper: (w: number) => number;
  /** Русские замечания об ослабленных ограничениях. */
  notes: string[];
  /** Сигнатура ограничений, влияющих на допустимость сочетаний съёмки. */
  signature: string;
}

const THRESHOLD: Record<Balance, number> = { variety: 0.45, balanced: 0.58, realism: 0.72 };
const RARITY_BALANCE: Record<Balance, Record<Rarity, number>> = {
  variety: { common: 1, uncommon: 1.5, rare: 2.6 },
  balanced: { common: 1, uncommon: 1, rare: 1 },
  realism: { common: 1.25, uncommon: 0.8, rare: 0.4 },
};

function temperExponent(r: number): number {
  const x = Math.min(100, Math.max(0, r));
  return x <= 50 ? 2 - x / 50 : 1 - ((x - 50) / 50) * 0.65;
}

/** Режим «Полный рандом»: ручные ограничения игнорируются, остаются возраст, внешний вид кадра и безопасность. */
function chaosView(s: Settings): Settings {
  const d = defaultSettings();
  return {
    ...s,
    choices: emptyChoices(),
    captureShares: { ...DEFAULT_CAPTURE_SHARES },
    faceRequired: false,
    allowSadEmotions: false,
    ratio: d.ratio,
    orientation: 'auto',
    rarity: d.rarity,
    climate: 'auto',
    locks: [],
  };
}

export function resolveSettings(input: Settings): Resolved {
  const chaos = input.mode === 'chaos';
  const s = chaos ? chaosView(input) : input;
  const notes: string[] = [];
  const pick = <T extends string>(key: keyof Settings['choices'], all: readonly T[], title: string): T[] => {
    const a = allowedOf(s.choices[key], all);
    if (a.relaxed) notes.push(`Выбор «${title}» оказался пустым — использованы все значения.`);
    return a.list;
  };

  const emotionAll = s.allowSadEmotions ? EMOTIONS : EMOTIONS.filter((e) => e !== 'sad' && e !== 'crying');
  const emotion = pick('emotion', emotionAll, 'Эмоции');
  const clothingCtl = s.choices.clothingStyle;
  const clothing = clothingCtl.mode === 'auto' ? null : allowedOf(clothingCtl, OUTFIT_TAGS).list;

  const sceneCtl = s.choices.scene;
  const sceneManual = sceneCtl.mode === 'manual' && sceneCtl.values.length ? new Set(sceneCtl.values) : null;
  const sceneExclude = sceneCtl.mode === 'exclude' ? new Set(sceneCtl.values) : new Set<string>();

  const shares = normalizeShares(s.captureShares);
  const rb = RARITY_BALANCE[s.balance];
  const rarityW = {
    common: Math.max(0, s.rarity.common) * rb.common,
    uncommon: Math.max(0, s.rarity.uncommon) * rb.uncommon,
    rare: Math.max(0, s.rarity.rare) * rb.rare,
  };
  const e = temperExponent(s.randomness);
  const ratio = fixedRatio(s);
  const R: Resolved = {
    settings: s,
    chaos,
    climate: s.climate === 'auto' ? 'temperate' : s.climate,
    age: { ...s.age },
    faceRequired: s.faceRequired,
    allowSad: s.allowSadEmotions,
    crowdOk: s.backgroundPeople,
    shares,
    season: pick('season', SEASONS, 'Сезон'),
    weather: pick('weather', WEATHERS, 'Погода'),
    time: pick('time', TIMES, 'Время суток'),
    category: pick('category', CATEGORIES, 'Категории'),
    framing: pick('framing', FRAMINGS, 'Кадрирование'),
    angle: pick('angle', ANGLES, 'Ракурс'),
    emotion,
    posture: pick('posture', POSTURES, 'Поза'),
    clothing,
    sceneManual,
    sceneExclude,
    app: {
      hairColor: pick('hairColor', HAIR_COLORS, 'Цвет волос'),
      hairLength: pick('hairLength', HAIR_LENGTHS, 'Длина волос'),
      hairType: pick('hairType', HAIR_TYPES, 'Тип волос'),
      hairStyle: pick('hairStyle', HAIR_STYLES, 'Причёска'),
      eyeColor: pick('eyeColor', EYE_COLORS, 'Цвет глаз'),
      skinTone: pick('skinTone', SKIN_TONES, 'Тон кожи'),
      build: pick('build', BUILDS, 'Телосложение'),
      height: pick('height', HEIGHTS, 'Рост'),
      makeup: pick('makeup', MAKEUPS, 'Макияж'),
      freckles: pick('freckles', FRECKLES, 'Веснушки'),
      glasses: pick('glasses', GLASSES, 'Очки'),
    },
    ratio,
    orientation: s.orientation,
    rarityW,
    look: { style: s.style, color: s.color, sharpness: s.sharpness },
    spontaneity: s.spontaneity,
    randomness: s.randomness,
    detailLevel: s.detailLevel,
    imperfections: s.imperfections,
    locks: new Set(s.locks),
    balance: s.balance,
    dupWindow: s.dupWindow,
    dupThreshold: THRESHOLD[s.balance],
    maxAttempts: 40,
    temper: (w) => (w > 0 ? Math.pow(w, e) : 0),
    notes,
    signature: '',
  };
  if (R.age.exact !== null) {
    R.age.min = R.age.exact;
    R.age.max = R.age.exact;
  }
  const captureOn = CAPTURES.filter((c) => shares[c] > 0).join(',');
  R.signature = [
    captureOn,
    R.framing.join(','),
    R.angle.join(','),
    R.posture.join(','),
    R.faceRequired ? 'F' : '-',
    ratio ? ratio.label : '-',
    R.orientation,
  ].join('|');
  return R;
}
