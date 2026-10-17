import type { Climate, Season, TimeOfDay, Weather } from '../core/vocab.ts';
import type { Scene } from '../core/types.ts';

export type WeatherWeights = Partial<Record<Weather, number>>;

/** Какая погода возможна в сезоне для данного климата и как часто. */
export const WEATHER_TABLE: Record<Climate, Record<Season, WeatherWeights>> = {
  temperate: {
    spring: { clear: 3, 'partly-cloudy': 3, overcast: 3, rain: 1.6, 'after-rain': 1.2, fog: 0.6, windy: 1.2 },
    summer: { clear: 4, 'partly-cloudy': 3, overcast: 1.5, rain: 1, 'after-rain': 0.9, windy: 1, heat: 1.6 },
    autumn: { clear: 2.5, 'partly-cloudy': 2.5, overcast: 3.5, rain: 2, 'after-rain': 1.4, fog: 1, windy: 1.4 },
    winter: { clear: 2.5, 'partly-cloudy': 2, overcast: 3.5, snow: 2.6, fog: 0.8, frost: 1.6, windy: 0.8, rain: 0.5, 'after-rain': 0.3 },
  },
  warm: {
    spring: { clear: 4, 'partly-cloudy': 3, overcast: 2, rain: 1.2, 'after-rain': 1, windy: 1.2, heat: 0.4 },
    summer: { clear: 5, 'partly-cloudy': 3, overcast: 1, rain: 0.6, 'after-rain': 0.6, windy: 1, heat: 3 },
    autumn: { clear: 4, 'partly-cloudy': 3, overcast: 2, rain: 1.4, 'after-rain': 1, windy: 1.2, heat: 0.4 },
    winter: { clear: 3.5, 'partly-cloudy': 3, overcast: 3, rain: 2, 'after-rain': 1.2, fog: 0.6, windy: 1.2 },
  },
  cold: {
    spring: { clear: 2.5, 'partly-cloudy': 2.5, overcast: 3.5, rain: 1.4, 'after-rain': 1, fog: 1, windy: 1.4, snow: 0.8, frost: 0.8 },
    summer: { clear: 3, 'partly-cloudy': 3, overcast: 3, rain: 1.6, 'after-rain': 1.2, fog: 0.6, windy: 1.4 },
    autumn: { clear: 2, 'partly-cloudy': 2, overcast: 3.5, rain: 2, 'after-rain': 1.2, fog: 1.2, windy: 1.6, snow: 0.8, frost: 1 },
    winter: { clear: 2, 'partly-cloudy': 1.5, overcast: 3, snow: 4, fog: 0.8, frost: 2.6, windy: 1 },
  },
};

export const TIME_WEIGHT: Record<TimeOfDay, number> = {
  dawn: 0.6,
  morning: 2.4,
  day: 3,
  'golden-hour': 1.8,
  dusk: 1,
  evening: 2,
  night: 1.2,
};

const GOLDEN_OK: readonly Weather[] = ['clear', 'partly-cloudy', 'windy', 'heat', 'after-rain', 'fog', 'frost'];

/** Совместимость погоды и времени суток (null — погода не применима). */
export function weatherTimeOk(weather: Weather | null, time: TimeOfDay): boolean {
  if (weather === null) return true;
  if (time === 'golden-hour') return GOLDEN_OK.includes(weather);
  if (weather === 'heat') return time === 'morning' || time === 'day' || time === 'evening';
  return true;
}

export function weatherEntries(climate: Climate, season: Season): [Weather, number][] {
  return Object.entries(WEATHER_TABLE[climate][season]) as [Weather, number][];
}

export interface Triple {
  season: Season;
  weather: Weather | null;
  time: TimeOfDay;
  weight: number;
}

const tripleCache = new WeakMap<Scene, Partial<Record<Climate, Triple[]>>>();

/** Все допустимые сочетания «сезон × погода × время» для сцены и климата. */
export function sceneTriples(scene: Scene, climate: Climate): Triple[] {
  let per = tripleCache.get(scene);
  if (!per) {
    per = {};
    tripleCache.set(scene, per);
  }
  const hit = per[climate];
  if (hit) return hit;
  const out: Triple[] = [];
  for (const season of scene.seasons) {
    if (scene.snowbound && !(season === 'winter' && climate !== 'warm')) continue;
    if (scene.weatherMode === 'irrelevant') {
      for (const time of scene.times) out.push({ season, weather: null, time, weight: TIME_WEIGHT[time] });
      continue;
    }
    for (const [weather, ww] of weatherEntries(climate, season)) {
      if (scene.weatherMode === 'visible' && !scene.weathers.includes(weather)) continue;
      for (const time of scene.times) {
        if (!weatherTimeOk(weather, time)) continue;
        out.push({ season, weather, time, weight: ww * TIME_WEIGHT[time] });
      }
    }
  }
  per[climate] = out;
  return out;
}

const BASE_OUT: Record<Climate, Record<Season, [number, number]>> = {
  temperate: { spring: [2, 3], summer: [1, 2], autumn: [2, 3], winter: [3, 4] },
  warm: { spring: [1, 2], summer: [0, 1], autumn: [1, 2], winter: [2, 3] },
  cold: { spring: [3, 4], summer: [2, 3], autumn: [3, 4], winter: [4, 4] },
};
const BASE_IN: Record<Season, [number, number]> = {
  spring: [1, 2],
  summer: [1, 2],
  autumn: [2, 3],
  winter: [2, 3],
};

export interface NeedInput {
  season: Season;
  climate: Climate;
  weather: Weather | null;
  time: TimeOfDay;
  dress: 'in' | 'out';
  /** Одежда определяется занятием (бассейн, зал, студия), а не погодой. */
  activityWear: boolean;
}

/** Диапазон тепловой потребности одежды: 0 — жара … 4 — мороз. */
export function thermalNeed(o: NeedInput): [number, number] {
  if (o.dress === 'in') return o.activityWear ? [0, 3] : [...BASE_IN[o.season]];
  let [lo, hi] = BASE_OUT[o.climate][o.season];
  const w = o.weather;
  if (w === 'heat') {
    lo = 0;
    hi = Math.min(hi, 1);
  }
  if (w === 'snow') {
    hi = 4;
    lo = o.season === 'winter' && o.climate !== 'warm' ? 4 : Math.max(lo, 3);
  }
  if (w === 'frost') {
    lo = 4;
    hi = 4;
  }
  if (o.season !== 'winter' && w !== 'heat' && w !== 'snow' && w !== 'frost') {
    const t = o.time;
    if (t === 'dawn' || t === 'night') {
      if (o.season !== 'summer') lo = Math.min(lo + 1, 4);
      hi = Math.min(hi + 1, 4);
    } else if (t === 'dusk' || t === 'evening') {
      hi = Math.min(hi + 1, 4);
    }
  }
  return [Math.min(lo, 4), Math.min(hi, 4)];
}

export function climateHasSnow(climate: Climate, season: Season): boolean {
  return season === 'winter' && climate !== 'warm';
}
