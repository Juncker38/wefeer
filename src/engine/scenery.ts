import type { GenericDetail, Imperfection, Scene } from '../core/types.ts';
import type { Capture, DetailLevel, Season, Style, TimeOfDay, Weather } from '../core/vocab.ts';
import { GENERIC_DETAILS, IMPERFECTIONS } from '../data/details.ts';
import type { Resolved } from './context.ts';
import type { Rng } from './rng.ts';

export interface Facts {
  season: Season;
  weather: Weather | null;
  time: TimeOfDay;
}

interface Cond {
  seasons?: readonly Season[] | undefined;
  weathers?: readonly Weather[] | undefined;
  times?: readonly TimeOfDay[] | undefined;
}

export function condMatches(c: Cond, f: Facts): boolean {
  if (c.seasons && !c.seasons.includes(f.season)) return false;
  if (c.weathers && (f.weather === null || !c.weathers.includes(f.weather))) return false;
  if (c.times && !c.times.includes(f.time)) return false;
  return true;
}

export function genericMatches(d: GenericDetail, scene: Scene, f: Facts): boolean {
  if (d.env && !d.env.includes(scene.env)) return false;
  if (d.tags && !d.tags.some((t) => scene.tags.includes(t))) return false;
  if (d.needsView && scene.view === 'none') return false;
  return condMatches(d, f);
}

const isConditional = (c: Cond): boolean => !!(c.seasons || c.weathers || c.times);

export interface PooledDetail {
  en: string;
  weight: number;
  specific: boolean;
}

export function detailPool(scene: Scene, f: Facts): PooledDetail[] {
  const out: PooledDetail[] = [];
  for (const d of scene.details) {
    if (!condMatches(d, f)) continue;
    out.push({ en: d.en, weight: isConditional(d) ? 3.2 : 2, specific: true });
  }
  for (const d of GENERIC_DETAILS) {
    if (!genericMatches(d, scene, f)) continue;
    out.push({ en: d.en, weight: isConditional(d) ? 1.8 : 1, specific: false });
  }
  return out;
}

/** Разрешено ли использовать этот текст детали в данной сцене и условиях. */
export function detailAllowed(text: string, scene: Scene, f: Facts): boolean {
  const own = scene.details.find((d) => d.en === text);
  if (own) return condMatches(own, f);
  const gen = GENERIC_DETAILS.find((d) => d.en === text);
  if (gen) return genericMatches(gen, scene, f);
  return false;
}

const COUNTS: Record<DetailLevel, { fg: number; mid: number; far: number; det: number }> = {
  low: { fg: 1, mid: 1, far: 1, det: 2 },
  medium: { fg: 2, mid: 1, far: 2, det: 3 },
  high: { fg: 2, mid: 2, far: 2, det: 4 },
};

export function imperfectionAllowed(d: Imperfection, scene: Scene, time: TimeOfDay, style: Style, capture: Capture): boolean {
  if (d.styles && !d.styles.includes(style)) return false;
  if (d.times && !d.times.includes(time)) return false;
  if (d.captures && !d.captures.includes(capture)) return false;
  if (d.env && !d.env.includes(scene.env)) return false;
  return true;
}

export interface Scenery {
  fg: string[];
  mid: string[];
  far: string[];
  details: string[];
  imperfections: string[];
}

export function pickScenery(R: Resolved, rng: Rng, scene: Scene, f: Facts, capture: Capture, keepDetails?: readonly string[] | undefined): Scenery {
  const n = COUNTS[R.detailLevel];
  const take = (label: string, list: readonly string[], k: number) => rng.fork(label).shuffle(list).slice(0, k);
  const fg = take('fg', scene.fg, n.fg);
  const mid = take('mid', scene.mid, n.mid);
  const far = take('far', scene.far, n.far);

  let details: string[];
  const dr = rng.fork('details');
  if (keepDetails && keepDetails.every((t) => detailAllowed(t, scene, f))) {
    details = [...keepDetails];
  } else {
    const pool = detailPool(scene, f);
    details = [];
    const specific = pool.filter((p) => p.specific);
    const first = dr.weighted(specific, (p) => p.weight);
    if (first) details.push(first.en);
    while (details.length < n.det) {
      const next = dr.weighted(pool, (p) => (details.includes(p.en) ? 0 : p.weight));
      if (!next) break;
      details.push(next.en);
    }
  }

  const imperfections: string[] = [];
  if (R.imperfections) {
    const ir = rng.fork('imperfections');
    const p = 0.35 + R.spontaneity / 200;
    const want = R.detailLevel === 'high' ? (ir.chance(p) ? 2 : 1) : R.detailLevel === 'low' ? (ir.chance(p * 0.6) ? 1 : 0) : ir.chance(p) ? 1 : 0;
    const pool = IMPERFECTIONS.filter((d) => imperfectionAllowed(d, scene, f.time, R.look.style, capture));
    for (let i = 0; i < want; i++) {
      const pick = ir.weighted(pool, (d) => (imperfections.includes(d.en) ? 0 : 1));
      if (pick) imperfections.push(pick.en);
    }
  }
  return { fg, mid, far, details, imperfections };
}

// ───────── Освещение ─────────

type Quality = Record<TimeOfDay, string[]>;
const DAY_QUALITY: Record<Weather, Partial<Quality>> = {
  clear: {
    dawn: ['cool, pale first light'],
    morning: ['clear, slightly cool morning light'],
    day: ['bright direct daylight with well-defined shadows'],
    'golden-hour': ['low, warm golden-hour light with long soft shadows'],
  },
  'partly-cloudy': {
    dawn: ['soft early light under broken cloud'],
    morning: ['bright morning light softened by passing clouds'],
    day: ['bright daylight shifting as clouds pass'],
    'golden-hour': ['warm low light slipping between clouds'],
  },
  overcast: {
    dawn: ['dim, even early light'],
    morning: ['flat, low-contrast morning light'],
    day: ['flat, low-contrast daylight with soft shadows'],
  },
  rain: {
    dawn: ['dim, cool early light'],
    morning: ['dim, cool light'],
    day: ['dim, cool daylight with soft diffuse shadows'],
  },
  'after-rain': {
    dawn: ['clean, cool early light'],
    morning: ['clean, slightly cool morning light'],
    day: ['clean, slightly cool daylight as the clouds break up'],
    'golden-hour': ['low warm light breaking through the clouds'],
  },
  fog: {
    dawn: ['diffuse, muted light scattered by fog'],
    morning: ['diffuse, muted light scattered by fog'],
    day: ['diffuse, muted daylight scattered by fog'],
    'golden-hour': ['faint warm glow diffused by fog'],
  },
  snow: {
    dawn: ['soft, bluish, nearly shadowless early light'],
    morning: ['soft, bluish, nearly shadowless light'],
    day: ['soft, bluish, nearly shadowless daylight'],
  },
  windy: {
    dawn: ['cool early light with fast-moving clouds'],
    morning: ['bright, restless morning light as clouds move quickly'],
    day: ['bright, restless daylight as clouds move quickly'],
    'golden-hour': ['warm low light flickering between moving clouds'],
  },
  heat: {
    morning: ['already hard, bright morning light'],
    day: ['hard, bright daylight with short shadows'],
    'golden-hour': ['strong low warm light, still hot'],
  },
  frost: {
    dawn: ['crisp, cold, clear first light'],
    morning: ['crisp, cold, clear morning light'],
    day: ['crisp, cold, clear daylight'],
    'golden-hour': ['low, pale gold light on a cold clear day'],
  },
};

const DARK: Record<'dusk' | 'evening' | 'night', string[]> = {
  dusk: ['dusk, the sky a deep fading blue', 'the last blue light of dusk'],
  evening: ['late evening with the daylight almost gone', 'evening, the daylight nearly gone'],
  night: ['night with no daylight', 'deep night outside'],
};

/** Описание освещения: источник берётся из сцены, качество — из времени суток и погоды. */
export function lightingFor(scene: Scene, time: TimeOfDay, weather: Weather | null, rng: Rng): string {
  const r = rng.fork('light');
  if (time === 'dusk' || time === 'evening' || time === 'night') {
    const head = scene.view === 'none' ? '' : `${r.pick(DARK[time])}, `;
    return `${head}lit by ${scene.nightLight}`;
  }
  if (scene.view === 'none') return `lit by ${scene.light}`;
  const w: Weather = weather ?? 'overcast';
  const set = DAY_QUALITY[w];
  const options = set[time] ?? set.day ?? DAY_QUALITY.overcast.day ?? ['even daylight'];
  return `${r.pick(options)}, with ${scene.light}`;
}
