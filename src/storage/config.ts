import type { Character, Subject } from '../core/types.ts';
import { MAX_USER_PRESETS, cleanName } from '../core/presets.ts';
import type { Preset } from '../core/presets.ts';
import { normalizeSettings } from '../core/settings.ts';
import type { Settings } from '../core/settings.ts';
import {
  AGE_MAX,
  AGE_MIN,
  BUILDS,
  EYE_COLORS,
  FRECKLES,
  GLASSES,
  HAIR_COLORS,
  HAIR_LENGTHS,
  HAIR_STYLES,
  HAIR_TYPES,
  HEIGHTS,
  MAKEUPS,
  SKIN_TONES,
} from '../core/vocab.ts';
import { FEATURE_BY_ID } from '../data/appearance.ts';
import { hairStylesFor } from '../engine/appearance.ts';

export const CONFIG_APP = 'RealPhoto Prompt Studio';
export const CONFIG_SCHEMA = 1;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | null => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null);

/** Проверка паспорта персонажа; null — данные некорректны. */
export function normalizeSubject(raw: unknown): Subject | null {
  if (!isObj(raw)) return null;
  const age = typeof raw.age === 'number' && Number.isInteger(raw.age) && raw.age >= AGE_MIN && raw.age <= AGE_MAX ? raw.age : null;
  const hairColor = oneOf(raw.hairColor, HAIR_COLORS);
  const hairLength = oneOf(raw.hairLength, HAIR_LENGTHS);
  const hairType = oneOf(raw.hairType, HAIR_TYPES);
  const hairStyle = oneOf(raw.hairStyle, HAIR_STYLES);
  const eyeColor = oneOf(raw.eyeColor, EYE_COLORS);
  const skinTone = oneOf(raw.skinTone, SKIN_TONES);
  const build = oneOf(raw.build, BUILDS);
  const height = oneOf(raw.height, HEIGHTS);
  const makeup = oneOf(raw.makeup, MAKEUPS);
  const freckles = oneOf(raw.freckles, FRECKLES);
  const glasses = oneOf(raw.glasses, GLASSES);
  if (age === null || !hairColor || !hairLength || !hairType || !hairStyle || !eyeColor || !skinTone || !build || !height || !makeup || !freckles || !glasses) return null;
  const features = Array.isArray(raw.features)
    ? raw.features.filter((f): f is string => typeof f === 'string' && FEATURE_BY_ID.has(f) && (FEATURE_BY_ID.get(f)?.minAge ?? 0) <= age).slice(0, 3)
    : [];
  const style = hairStylesFor(hairLength).includes(hairStyle) ? hairStyle : 'loose';
  return { age, hairColor, hairLength, hairType, hairStyle: style, eyeColor, skinTone, build, height, makeup, freckles, glasses, features };
}

export function normalizeCharacter(raw: unknown): Character | null {
  if (!isObj(raw)) return null;
  const subject = normalizeSubject(raw.subject);
  if (!subject) return null;
  const id = typeof raw.id === 'string' && /^[A-Za-z0-9_-]{3,40}$/.test(raw.id) ? raw.id : null;
  if (!id) return null;
  const name = cleanName(typeof raw.name === 'string' ? raw.name : '') || 'Персонаж';
  return { id, name, subject, createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0 };
}

export interface ConfigBundle {
  settings: Settings;
  presets: Preset[];
  character: Character | null;
}

export function exportConfig(b: ConfigBundle, now: number = Date.now()): string {
  return JSON.stringify(
    {
      app: CONFIG_APP,
      schema: CONFIG_SCHEMA,
      exportedAt: new Date(now).toISOString(),
      settings: b.settings,
      presets: b.presets.filter((p) => !p.builtin),
      character: b.character,
    },
    null,
    2,
  );
}

export type ImportResult = { ok: true; bundle: ConfigBundle; warnings: string[] } | { ok: false; error: string };

/** Разбор и проверка файла конфигурации; повреждённые части отбрасываются с предупреждением. */
export function importConfig(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Файл не является корректным JSON.' };
  }
  if (!isObj(raw)) return { ok: false, error: 'Неверная структура файла конфигурации.' };
  if (raw.app !== CONFIG_APP) return { ok: false, error: 'Это не файл конфигурации RealPhoto Prompt Studio.' };
  if (raw.schema !== CONFIG_SCHEMA) return { ok: false, error: `Неподдерживаемая версия конфигурации: ${String(raw.schema)}.` };
  const warnings: string[] = [];
  const norm = normalizeSettings(raw.settings);
  warnings.push(...norm.problems);
  const presets: Preset[] = [];
  if (Array.isArray(raw.presets)) {
    for (const p of raw.presets.slice(0, MAX_USER_PRESETS)) {
      if (!isObj(p) || typeof p.name !== 'string' || typeof p.id !== 'string' || !/^[A-Za-z0-9_-]{3,60}$/.test(p.id)) {
        warnings.push('Один из пресетов пропущен: неверный формат.');
        continue;
      }
      const r = normalizeSettings(p.settings);
      r.settings.seed = '';
      r.settings.locks = [];
      presets.push({ id: p.id, name: cleanName(p.name) || 'Без названия', settings: r.settings });
    }
  }
  let character: Character | null = null;
  if (raw.character !== null && raw.character !== undefined) {
    character = normalizeCharacter(raw.character);
    if (!character) warnings.push('Персонаж пропущен: паспорт внешности повреждён.');
  }
  return { ok: true, bundle: { settings: norm.settings, presets, character }, warnings };
}
