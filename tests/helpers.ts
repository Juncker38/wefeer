import { defaultSettings } from '../src/core/settings.ts';
import type { Settings } from '../src/core/settings.ts';
import type { PhotoScenario } from '../src/core/types.ts';
import { generateScenario } from '../src/engine/generate.ts';
import type { GenerateInput, GenerateResult } from '../src/engine/generate.ts';

export function settingsWith(patch?: (s: Settings) => void): Settings {
  const s = defaultSettings();
  patch?.(s);
  return s;
}

export function gen(seed: string, patch?: (s: Settings) => void, extra: Partial<GenerateInput> = {}): GenerateResult {
  const out = generateScenario({ settings: settingsWith(patch), seed, ...extra });
  if (!out.ok) throw new Error(`${seed}: ${out.reason} ${out.hints.join(' ')}`);
  return out.result;
}

export const seeds = (n: number, prefix = 'T'): string[] => Array.from({ length: n }, (_, i) => `${prefix}-${i}`);

/** Простые проверки на противоречия в тексте: ночь без солнца, снег только зимой и т. д. */
export function contradictions(text: string, s: PhotoScenario, hasWaterTag = false): string[] {
  const out: string[] = [];
  const dark = s.time === 'dusk' || s.time === 'evening' || s.time === 'night';
  if (dark && /\b(sun|sunny|sunlight|midday|noon)\b/i.test(text)) out.push('солнце в тёмное время суток');
  if (s.time === 'night' && /\b(golden[- ]hour|daylight)\b/i.test(text.replace(/with no daylight/gi, '').replace(/daylight nearly gone|daylight almost gone/gi, ''))) out.push('дневной свет ночью');
  if (s.season !== 'winter' && /\b(snow|snowy|snowfall|frost|frosty|icy)\b/i.test(text)) out.push(`снег или мороз в сезоне ${s.season}`);
  if (s.season !== 'autumn' && /\bfallen leaves\b/i.test(text)) out.push('опавшие листья не осенью');
  const wet = s.weather === 'rain' || s.weather === 'after-rain';
  if (!wet && /\b(rain|rainy|puddles?|umbrella|raindrops?|drizzle)\b/i.test(text)) out.push('дождь при погоде без дождя');
  if (!wet && !hasWaterTag && /\b(wet|damp|soaked)\b/i.test(text)) out.push('мокрые поверхности без дождя');
  if (s.weather !== 'fog' && /\b(fog|foggy|mist|misty)\b/i.test(text)) out.push('туман без тумана');
  if (s.weather === 'snow' && s.season !== 'winter' && s.climate !== 'cold') out.push('снегопад вне зимы');
  if (s.weatherMode === 'irrelevant' && /\b(overcast|clear sky|breezy|snowing|drizzl)/i.test(text)) out.push('погода в помещении без окон');
  if (s.capture !== 'selfie-mirror' && s.capture !== 'selfie-reflection' && /\bmirror selfie\b/i.test(text)) out.push('зеркальное селфи без зеркала');
  if ((s.capture === 'selfie-arm' || s.capture === 'front-camera') && /photographed by|taken by an acquaintance|taken by a friend/i.test(text)) out.push('селфи, снятое другим человеком');
  if (s.angle === 'back-head-turn' && /\bselfie\b/i.test(text)) out.push('селфи со спины');
  return out;
}
