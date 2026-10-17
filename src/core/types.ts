import type {
  Angle,
  Build,
  Capture,
  Category,
  Climate,
  ColorMode,
  DetailLevel,
  Emotion,
  Env,
  EyeColor,
  Framing,
  Freckles,
  Gaze,
  Glasses,
  HairColor,
  HairLength,
  HairStyle,
  HairType,
  Height,
  LockKey,
  Makeup,
  Mode,
  Orientation,
  OutfitTag,
  Posture,
  Rarity,
  Season,
  SceneTag,
  Sharpness,
  SkinTone,
  Style,
  TimeOfDay,
  View,
  Weather,
} from './vocab.ts';

// ───────── Библиотека сцен: входной (авторский) формат ─────────

/** [en (причастие), ru, posture, hands, flags?] — flags: 'back' | 'hidden' | 'obj' через пробел. */
export type ActionInput = readonly [en: string, ru: string, posture: Posture, hands: 0 | 1 | 2, flags?: string];

/** Строка — безусловная деталь; кортеж — деталь с условием, например 'w:rain,after-rain s:autumn t:evening'. */
export type DetailInput = string | readonly [text: string, when: string];

export interface SceneInput {
  id: string;
  cat: Category;
  rar: 'c' | 'u' | 'r';
  ru: string;
  place: string;
  env: 'in' | 'out' | 'cov';
  view: 'open' | 'win' | 'none';
  dress?: 'in' | 'out';
  se: readonly Season[];
  we?: readonly Weather[];
  ti: readonly TimeOfDay[];
  act: readonly ActionInput[];
  out: readonly OutfitTag[];
  fg: readonly string[];
  mid: readonly string[];
  far: readonly string[];
  det: readonly DetailInput[];
  light: string;
  night?: string;
  ang: readonly Angle[];
  mirror?: boolean;
  glass?: boolean;
  solo?: boolean;
  crowd?: 0 | 1 | 2;
  noTripod?: boolean;
  tags?: readonly SceneTag[];
}

// ───────── Нормализованная сцена ─────────

export interface Action {
  id: string;
  en: string;
  ru: string;
  posture: Posture;
  hands: 0 | 1 | 2;
  back: boolean;
  hidden: boolean;
  obj: boolean;
}

export interface Detail {
  en: string;
  seasons?: Season[];
  weathers?: Weather[];
  times?: TimeOfDay[];
}

export type WeatherMode = 'visible' | 'implied' | 'irrelevant';

export interface Scene {
  id: string;
  category: Category;
  rarity: Rarity;
  titleRu: string;
  place: string;
  env: Env;
  view: View;
  dress: 'in' | 'out';
  weatherMode: WeatherMode;
  seasons: Season[];
  weathers: Weather[];
  times: TimeOfDay[];
  actions: Action[];
  outfits: OutfitTag[];
  fg: string[];
  mid: string[];
  far: string[];
  details: Detail[];
  light: string;
  nightLight: string;
  angles: Angle[];
  mirror: boolean;
  glass: boolean;
  solo: boolean;
  crowd: 0 | 1 | 2;
  noTripod: boolean;
  tags: SceneTag[];
  snowbound: boolean;
}

// ───────── Прочие данные ─────────

export interface OutfitDef {
  id: string;
  /** Английская фраза без подлежащего; может содержать {c} — подстановка цвета. */
  en: string;
  ru: string;
  /** Диапазон тепловой потребности [мин, макс], 0 — жара … 4 — мороз. */
  w: readonly [number, number];
  tags: readonly OutfitTag[];
  /** 'no' — не подходит под дождь / снег. */
  rain?: 'no';
  snow?: 'no';
  rainwear?: boolean;
  hood?: boolean;
}

export interface GenericDetail {
  en: string;
  env?: readonly Env[];
  tags?: readonly SceneTag[];
  seasons?: readonly Season[];
  weathers?: readonly Weather[];
  times?: readonly TimeOfDay[];
  /** Только для сцен с видом наружу (окно или открытое пространство). */
  needsView?: boolean;
}

export interface Imperfection {
  en: string;
  styles?: readonly Style[];
  times?: readonly TimeOfDay[];
  captures?: readonly Capture[];
  env?: readonly Env[];
}

// ───────── Результат генерации ─────────

export interface Subject {
  age: number;
  hairColor: HairColor;
  hairLength: HairLength;
  hairType: HairType;
  hairStyle: HairStyle;
  eyeColor: EyeColor;
  skinTone: SkinTone;
  build: Build;
  height: Height;
  makeup: Makeup;
  freckles: Freckles;
  glasses: Glasses;
  features: string[];
}

/** Постоянный персонаж: паспорт внешности хранится только в приложении. */
export interface Character {
  id: string;
  name: string;
  subject: Subject;
  createdAt: number;
}

export interface ScenarioRatio {
  w: number;
  h: number;
  label: string;
  orientation: Orientation;
}

export interface PhotoScenario {
  schema: 1;
  engine: string;
  id: string;
  seed: string;
  mode: Mode;
  index: number;
  characterId: string | null;
  subject: Subject;
  sceneId: string;
  category: Category;
  rarity: Rarity;
  sceneTitle: string;
  place: string;
  env: Env;
  view: View;
  dress: 'in' | 'out';
  weatherMode: WeatherMode;
  climate: Climate;
  season: Season;
  weather: Weather | null;
  time: TimeOfDay;
  action: Action;
  capture: Capture;
  framing: Framing;
  angle: Angle;
  gaze: Gaze;
  emotion: Emotion;
  faceVisibility: 'full' | 'partial';
  hand: 'left' | 'right';
  outfit: { id: string; en: string; ru: string; tags: OutfitTag[] };
  accessories: string[];
  fg: string[];
  mid: string[];
  far: string[];
  details: string[];
  imperfections: string[];
  light: string;
  crowd: 'none' | 'incidental';
  ratio: ScenarioRatio;
  look: { style: Style; color: ColorMode; sharpness: Sharpness };
  spontaneity: number;
  detailLevel: DetailLevel;
  fingerprint: string;
  attempt: number;
  notes: string[];
  locks: LockKey[];
}

export const ASPECTS = [
  'subject',
  'scene',
  'season',
  'weather',
  'time',
  'action',
  'capture',
  'framing',
  'angle',
  'gaze',
  'emotion',
  'outfit',
  'ratio',
  'details',
] as const;
export type Aspect = (typeof ASPECTS)[number];

export interface Issue {
  aspect: Aspect;
  code: string;
  message: string;
}

export interface HistoryFeature {
  sceneId: string;
  category: Category;
  actionId: string;
  capture: Capture;
  framing: Framing;
  angle: Angle;
  outfitId: string;
  season: Season;
  weather: Weather | null;
  time: TimeOfDay;
  emotion: Emotion;
  hairColor: HairColor;
  age: number;
}
