import type { Action, Detail, Scene, SceneInput } from '../../core/types.ts';
import type { Season, TimeOfDay, Weather } from '../../core/vocab.ts';
import { SEASONS, TIMES, WEATHERS } from '../../core/vocab.ts';

// Короткие наборы для авторов сцен.
export const SE_ALL = SEASONS;
export const SE_NOT_WINTER = ['spring', 'summer', 'autumn'] as const;
export const SE_WARM = ['spring', 'summer'] as const;
export const SE_COOL = ['autumn', 'winter'] as const;
export const SE_SUMMER = ['summer'] as const;
export const SE_WINTER = ['winter'] as const;
export const SE_AUTUMN = ['autumn'] as const;

export const WE_ALL = WEATHERS;
/** Сухая «рабочая» погода без осадков и экстрима. */
export const WE_FAIR = ['clear', 'partly-cloudy', 'overcast', 'windy'] as const;
export const WE_SUN = ['clear', 'partly-cloudy', 'windy', 'heat'] as const;
export const WE_WET = ['rain', 'after-rain'] as const;
export const WE_NO_HEAT = ['clear', 'partly-cloudy', 'overcast', 'rain', 'after-rain', 'fog', 'snow', 'windy', 'frost'] as const;

export const TI_ALL = TIMES;
export const TI_DAYLIGHT = ['dawn', 'morning', 'day', 'golden-hour'] as const;
export const TI_NO_DAWN = ['morning', 'day', 'golden-hour', 'dusk', 'evening', 'night'] as const;
/** Для сцен без вида наружу (view: 'none') — только эти значения. */
export const TI_INDOOR = ['morning', 'day', 'evening', 'night'] as const;

export interface ParsedWhen {
  seasons?: Season[];
  weathers?: Weather[];
  times?: TimeOfDay[];
}

/** Разбор условия вида 'w:rain,after-rain s:autumn t:evening,night'. */
export function parseWhen(when: string): ParsedWhen {
  const out: ParsedWhen = {};
  for (const token of when.trim().split(/\s+/)) {
    const m = /^([swt]):(.+)$/.exec(token);
    if (!m) throw new Error(`некорректный токен условия «${token}» в «${when}»`);
    const key = m[1] as 's' | 'w' | 't';
    const values = (m[2] as string).split(',');
    const pool: readonly string[] = key === 's' ? SEASONS : key === 'w' ? WEATHERS : TIMES;
    for (const v of values) {
      if (!pool.includes(v)) throw new Error(`неизвестное значение «${v}» для «${key}:» в «${when}»`);
    }
    if (key === 's') out.seasons = values as Season[];
    else if (key === 'w') out.weathers = values as Weather[];
    else out.times = values as TimeOfDay[];
  }
  return out;
}

const ENV_MAP = { in: 'indoor', out: 'outdoor', cov: 'covered' } as const;
const VIEW_MAP = { open: 'open', win: 'window', none: 'none' } as const;
const RARITY_MAP = { c: 'common', u: 'uncommon', r: 'rare' } as const;

export function normalizeScene(input: SceneInput): Scene {
  const env = ENV_MAP[input.env];
  const view = VIEW_MAP[input.view];
  const dress = input.dress ?? (env === 'indoor' ? 'in' : 'out');
  const weatherMode = view !== 'none' ? 'visible' : dress === 'out' ? 'implied' : 'irrelevant';
  const actions: Action[] = input.act.map(([en, ru, posture, hands, flags], i) => {
    const f = (flags ?? '').split(/\s+/).filter(Boolean);
    return {
      id: `${input.id}.${i}`,
      en,
      ru,
      posture,
      hands,
      back: f.includes('back'),
      hidden: f.includes('hidden'),
      obj: f.includes('obj'),
    };
  });
  const details: Detail[] = input.det.map((d) => {
    if (typeof d === 'string') return { en: d };
    const w = parseWhen(d[1]);
    const out: Detail = { en: d[0] };
    if (w.seasons) out.seasons = w.seasons;
    if (w.weathers) out.weathers = w.weathers;
    if (w.times) out.times = w.times;
    return out;
  });
  const tags = [...(input.tags ?? [])];
  return {
    id: input.id,
    category: input.cat,
    rarity: RARITY_MAP[input.rar],
    titleRu: input.ru,
    place: input.place,
    env,
    view,
    dress,
    weatherMode,
    seasons: [...input.se],
    weathers: view === 'none' ? [...WEATHERS] : [...(input.we ?? WEATHERS)],
    times: [...input.ti],
    actions,
    outfits: [...input.out],
    fg: [...input.fg],
    mid: [...input.mid],
    far: [...input.far],
    details,
    light: input.light,
    nightLight: input.night ?? input.light,
    angles: [...input.ang],
    mirror: input.mirror ?? false,
    glass: input.glass ?? false,
    solo: input.solo ?? false,
    crowd: input.crowd ?? 0,
    noTripod: input.noTripod ?? false,
    tags,
    snowbound: tags.includes('snowbound'),
  };
}
