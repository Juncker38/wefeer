import type { Settings } from './settings.ts';
import { cloneSettings, defaultSettings, normalizeSettings } from './settings.ts';
import type { Capture } from './vocab.ts';

export interface Preset {
  id: string;
  name: string;
  description?: string;
  builtin?: boolean;
  settings: Settings;
}

type Patch = (s: Settings) => void;

function build(id: string, name: string, description: string, patch: Patch): Preset {
  const s = defaultSettings();
  patch(s);
  return { id, name, description, builtin: true, settings: normalizeSettings(s).settings };
}

const shares = (s: Settings, v: Partial<Record<Capture, number>>) => {
  for (const k of Object.keys(s.captureShares) as Capture[]) s.captureShares[k] = v[k] ?? 0;
};

export const BUILTIN_PRESETS: readonly Preset[] = [
  build('natural-selfie', 'Естественное селфи', 'Преимущественно селфи: с вытянутой рукой, фронтальная камера, иногда зеркало.', (s) => {
    shares(s, { 'selfie-arm': 42, 'front-camera': 22, 'selfie-mirror': 10, 'selfie-reflection': 6, 'tripod-timer': 4, 'by-acquaintance': 6, 'by-friend-walk': 4, candid: 6 });
    s.spontaneity = 45;
  }),
  build('friend-photo', 'Фото от подруги', 'Кадры, снятые знакомым или другом, без селфи.', (s) => {
    shares(s, { 'by-acquaintance': 45, 'by-friend-walk': 30, candid: 15, 'tripod-timer': 10 });
    s.spontaneity = 55;
  }),
  build('active-rest', 'Активный отдых', 'Природа, вода и спорт, путешествия; больше движения.', (s) => {
    s.choices.category = { mode: 'manual', values: ['nature', 'water-sport', 'travel'] };
    shares(s, { 'selfie-arm': 18, 'front-camera': 6, 'tripod-timer': 10, 'by-acquaintance': 18, 'by-friend-walk': 22, candid: 26 });
    s.spontaneity = 70;
  }),
  build('winter-city', 'Зимний город', 'Зима в городе: улицы, кафе, бытовые сцены.', (s) => {
    s.choices.season = { mode: 'manual', values: ['winter'] };
    s.choices.category = { mode: 'manual', values: ['city', 'food', 'everyday'] };
    s.choices.weather = { mode: 'manual', values: ['snow', 'overcast', 'frost', 'clear', 'partly-cloudy'] };
  }),
  build('home-frame', 'Домашний кадр', 'Только домашние сцены.', (s) => {
    s.choices.category = { mode: 'manual', values: ['home'] };
    s.spontaneity = 50;
  }),
  build('random-moment', 'Случайный момент', 'Нечаянные candid-кадры, высокая спонтанность, лёгкие несовершенства.', (s) => {
    shares(s, { candid: 55, 'by-friend-walk': 25, 'by-acquaintance': 10, 'selfie-arm': 6, 'front-camera': 4 });
    s.spontaneity = 85;
    s.imperfections = true;
  }),
  build('sharp-background', 'Чёткий фон', 'Максимально читаемый фон: съёмка на камеру, подробные детали, без размытия.', (s) => {
    s.sharpness = 'sharp';
    s.style = 'camera';
    s.detailLevel = 'high';
    s.length = 'detailed';
  }),
];

export const MAX_USER_PRESETS = 50;

export function newPresetId(now: number = Date.now()): string {
  return `user-${now.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, 60);
}

export function createPreset(name: string, settings: Settings, id: string = newPresetId()): Preset {
  const copy = cloneSettings(settings);
  copy.seed = '';
  copy.locks = [];
  return { id, name: cleanName(name) || 'Без названия', settings: copy };
}

export function renamePreset(presets: readonly Preset[], id: string, name: string): Preset[] {
  const n = cleanName(name);
  if (!n) return [...presets];
  return presets.map((p) => (p.id === id && !p.builtin ? { ...p, name: n } : p));
}

export function deletePreset(presets: readonly Preset[], id: string): Preset[] {
  return presets.filter((p) => p.id !== id || p.builtin);
}

/** Применение пресета: настройки заменяются, но seed, закрепления и лимит истории остаются прежними. */
export function applyPreset(current: Settings, preset: Preset): Settings {
  const next = cloneSettings(preset.settings);
  next.seed = current.seed;
  next.locks = [...current.locks];
  next.historyLimit = current.historyLimit;
  return next;
}
