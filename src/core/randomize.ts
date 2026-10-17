import { CAPTURES, RATIO_IDS } from './vocab.ts';
import type { Season, Weather } from './vocab.ts';
import { CATEGORIES, HAIR_STYLES, SEASONS, TIMES } from './vocab.ts';
import { cloneSettings, emptyChoices } from './settings.ts';
import type { ChoiceKey, Settings } from './settings.ts';
import { WEATHER_TABLE } from '../engine/climate.ts';
import { countFeasibleScenes } from '../engine/diversity.ts';
import { createRng } from '../engine/rng.ts';
import { CHOICE_OPTIONS } from './settings.ts';
import { hairStylesFor } from '../engine/appearance.ts';
import type { HairLength } from './vocab.ts';

const APPEARANCE_KEYS = ['hairColor', 'hairLength', 'hairType', 'eyeColor', 'skinTone', 'build', 'height', 'makeup', 'freckles'] as const;

/** «Случайно всё»: заполняет поля случайными значениями так, чтобы осталось достаточно локаций. */
export function randomizeSettings(base: Settings, seed: string): Settings {
  const rng = createRng(`${seed}::randomize`);
  const s = cloneSettings(base);
  s.choices = emptyChoices();

  const manual = (key: ChoiceKey, values: string[]) => {
    s.choices[key] = { mode: 'manual', values };
  };
  for (const key of APPEARANCE_KEYS) manual(key, [rng.pick(CHOICE_OPTIONS[key])]);
  const length = s.choices.hairLength.values[0] as HairLength;
  const styles = hairStylesFor(length).filter((x) => HAIR_STYLES.includes(x));
  manual('hairStyle', [rng.pick(styles)]);
  manual('glasses', [rng.weighted(['none', 'clear'], (g) => (g === 'none' ? 4 : 1)) ?? 'none']);

  const season: Season = rng.pick(SEASONS);
  manual('season', [season]);
  const weathers = Object.keys(WEATHER_TABLE[s.climate === 'auto' ? 'temperate' : s.climate][season]) as Weather[];
  manual('weather', [rng.pick(weathers)]);
  manual('time', [rng.pick(TIMES.filter((t) => t !== 'dawn' || rng.chance(0.4)))]);
  manual('category', rng.shuffle(CATEGORIES).slice(0, rng.range(2, 4)));

  const on = rng.shuffle(CAPTURES).slice(0, rng.range(3, CAPTURES.length));
  for (const c of CAPTURES) s.captureShares[c] = on.includes(c) ? rng.range(5, 40) : 0;
  s.ratio = { mode: rng.chance(0.4) ? 'preset' : 'auto', preset: rng.pick(RATIO_IDS), custom: s.ratio.custom };
  s.orientation = 'auto';
  s.age = { min: 20, max: 45, exact: rng.range(20, 45) };
  s.spontaneity = rng.range(20, 90);
  s.randomness = rng.range(35, 80);
  s.seed = '';

  // Если случайные ограничения слишком тесные — ослабляем их по очереди.
  const relax: ChoiceKey[] = ['weather', 'time', 'category', 'season'];
  for (const key of relax) {
    if (countFeasibleScenes(s) >= 12) break;
    s.choices[key] = { mode: 'auto', values: [] };
  }
  if (countFeasibleScenes(s) < 12) s.ratio = { ...s.ratio, mode: 'auto' };
  return s;
}
