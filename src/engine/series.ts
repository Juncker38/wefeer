import type { Character, HistoryFeature, PhotoScenario, Subject } from '../core/types.ts';
import type { Settings } from '../core/settings.ts';
import type { Category, SeriesTheme, TimeOfDay } from '../core/vocab.ts';
import { L_SERIES_THEME } from '../core/labels.ts';
import type { Keep } from './compose.ts';
import { generateScenario } from './generate.ts';
import { createRng } from './rng.ts';
import { featuresOf } from './similarity.ts';

type ConcreteTheme = Exclude<SeriesTheme, 'auto'>;

const THEMES: Record<ConcreteTheme, { categories: Category[]; times: TimeOfDay[] }> = {
  'day-in-city': { categories: ['city', 'food', 'everyday'], times: ['morning', 'morning', 'day', 'day', 'golden-hour', 'evening', 'night'] },
  trip: { categories: ['travel', 'city', 'nature', 'food'], times: ['morning', 'day', 'day', 'golden-hour', 'evening', 'night'] },
  'weekend-home': { categories: ['home', 'everyday', 'food'], times: ['morning', 'morning', 'day', 'evening', 'evening', 'night'] },
  'outdoor-day': { categories: ['nature', 'water-sport', 'travel'], times: ['morning', 'morning', 'day', 'day', 'golden-hour', 'dusk'] },
};

export interface SeriesInput {
  settings: Settings;
  seed: string;
  count: number;
  character?: Character | null;
  history?: readonly HistoryFeature[];
  prev?: PhotoScenario | null;
}

export interface SeriesRunner {
  theme: ConcreteTheme;
  title: string;
  step(i: number): PhotoScenario | null;
  readonly frames: readonly PhotoScenario[];
}

function themeCategories(settings: Settings, theme: ConcreteTheme): Settings['choices']['category'] {
  const wanted = THEMES[theme].categories;
  const user = settings.choices.category;
  if (user.mode === 'manual' && user.values.length) {
    const both = wanted.filter((c) => user.values.includes(c));
    return { mode: 'manual', values: both.length ? both : user.values };
  }
  if (user.mode === 'exclude') {
    const left = wanted.filter((c) => !user.values.includes(c));
    return { mode: 'manual', values: left.length ? left : wanted };
  }
  return { mode: 'manual', values: wanted };
}

function withoutScenes(settings: Settings, used: readonly string[]): Settings['choices']['scene'] {
  const ctl = settings.choices.scene;
  if (!used.length) return ctl;
  if (ctl.mode === 'manual') {
    const left = ctl.values.filter((v) => !used.includes(v));
    return left.length ? { mode: 'manual', values: left } : ctl;
  }
  return { mode: 'exclude', values: [...new Set([...(ctl.mode === 'exclude' ? ctl.values : []), ...used])] };
}

/** Серия: один персонаж, общий сезон и логика дня, разные локации и ракурсы без буквальных повторов. */
export function createSeriesRunner(input: SeriesInput): SeriesRunner {
  const { settings, count } = input;
  const rng = createRng(`${input.seed}::series`);
  const theme: ConcreteTheme =
    settings.seriesTheme !== 'auto' ? settings.seriesTheme : rng.pick(Object.keys(THEMES) as ConcreteTheme[]);
  const times = THEMES[theme].times;
  const frames: PhotoScenario[] = [];
  let subject: Subject | null = input.character?.subject ?? null;

  return {
    theme,
    title: L_SERIES_THEME[theme],
    frames,
    step(i) {
      const used = frames.map((f) => f.sceneId);
      const s: Settings = {
        ...settings,
        mode: 'series',
        balance: 'variety',
        dupWindow: Math.max(settings.dupWindow, count + 5),
        choices: { ...settings.choices, category: themeCategories(settings, theme), scene: withoutScenes(settings, used) },
      };
      const soft: Keep = {};
      const first = frames[0];
      if (first) {
        soft.season = first.season;
        if (first.weather !== null) soft.weather = first.weather;
      }
      const t = times[Math.round((i * (times.length - 1)) / Math.max(1, count - 1))];
      if (t) soft.time = t;
      const last = frames[frames.length - 1];
      if (last) {
        soft.outfitId = last.outfit.id;
        soft.outfitEn = last.outfit.en;
      }
      const history = [...frames.map(featuresOf).reverse(), ...(input.history ?? [])];
      const out = generateScenario({
        settings: s,
        seed: `${input.seed}~f${i + 1}`,
        seedLabel: input.seed,
        history,
        soft,
        subjectOverride: subject,
        character: input.character ?? null,
        prev: i === 0 ? (input.prev ?? null) : null,
        index: i,
      });
      if (!out.ok) return null;
      const sc = out.result.scenario;
      if (!subject) subject = sc.subject;
      frames.push(sc);
      return sc;
    },
  };
}

export function generateSeries(input: SeriesInput): { scenarios: PhotoScenario[]; theme: ConcreteTheme; title: string; failures: number } {
  const runner = createSeriesRunner(input);
  let failures = 0;
  for (let i = 0; i < input.count; i++) if (!runner.step(i)) failures += 1;
  return { scenarios: [...runner.frames], theme: runner.theme, title: runner.title, failures };
}
