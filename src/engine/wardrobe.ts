import type { OutfitDef, Scene } from '../core/types.ts';
import type { Capture, OutfitTag, Season, TimeOfDay, Weather } from '../core/vocab.ts';
import { ACCESSORIES, ACCESSORY_BY_ID } from '../data/accessories.ts';
import type { AccessoryCtx } from '../data/accessories.ts';
import { OUTFIT_COLORS, OUTFITS } from '../data/outfits.ts';
import type { Climate } from '../core/vocab.ts';
import { thermalNeed } from './climate.ts';
import type { Resolved } from './context.ts';
import type { Rng } from './rng.ts';
import { isSelfie } from './rules.ts';

export const OUTFIT_BY_ID: ReadonlyMap<string, OutfitDef> = new Map(OUTFITS.map((o) => [o.id, o]));

const FALLBACK_COLORS = ['olive', 'navy', 'charcoal', 'cream', 'rust', 'sage green'];

/** Одежда определяется занятием (бассейн, зал, студия), а не сезоном. */
export function activityWear(scene: Scene): boolean {
  return scene.outfits.every((t) => t === 'swim' || t === 'sport' || t === 'dance');
}

export function needOf(scene: Scene, season: Season, weather: Weather | null, time: TimeOfDay, climate: Climate): [number, number] {
  return thermalNeed({ season, climate, weather, time, dress: scene.dress, activityWear: activityWear(scene) });
}

export function outfitReason(o: OutfitDef, scene: Scene, need: [number, number], weather: Weather | null): string | null {
  if (!o.tags.some((t) => scene.outfits.includes(t))) return 'одежда не подходит к месту и занятию';
  if (o.w[1] < need[0]) return 'одежда слишком тёплая для такой погоды';
  if (o.w[0] > need[1]) return 'одежда слишком лёгкая для такой погоды';
  if (scene.dress === 'out') {
    if (weather === 'rain' && o.rain === 'no') return 'одежда не годится для дождя';
    if ((weather === 'snow' || weather === 'frost') && o.snow === 'no') return 'одежда не годится для снега и мороза';
  }
  return null;
}

export function outfitPool(scene: Scene, need: [number, number], weather: Weather | null): OutfitDef[] {
  return OUTFITS.filter((o) => outfitReason(o, scene, need, weather) === null);
}

export function hasOutfit(scene: Scene, season: Season, weather: Weather | null, time: TimeOfDay, climate: Climate): boolean {
  const need = needOf(scene, season, weather, time, climate);
  return OUTFITS.some((o) => outfitReason(o, scene, need, weather) === null);
}

function colorize(en: string, rng: Rng): string {
  const palette = OUTFIT_COLORS.length ? OUTFIT_COLORS : FALLBACK_COLORS;
  const first = rng.pick(palette);
  const second = rng.pick(palette.filter((c) => c !== first).length ? palette.filter((c) => c !== first) : palette);
  let n = 0;
  return en.replace(/\{c\}/g, () => (n++ === 0 ? first : second));
}

export interface PickedOutfit {
  def: OutfitDef;
  en: string;
}

export function pickOutfit(
  R: Resolved,
  rng: Rng,
  scene: Scene,
  f: { season: Season; weather: Weather | null; time: TimeOfDay },
  opts: { keepId?: string | undefined; keepEn?: string | undefined; avoidId?: string | undefined; notes: string[] },
): PickedOutfit | null {
  const need = needOf(scene, f.season, f.weather, f.time, R.climate);
  let pool = outfitPool(scene, need, f.weather);
  if (pool.length === 0) return null;
  if (opts.keepId) {
    const kept = pool.find((o) => o.id === opts.keepId);
    if (kept) return { def: kept, en: opts.keepEn ?? colorize(kept.en, rng.fork('color')) };
  }
  if (R.clothing) {
    const styled = pool.filter((o) => o.tags.some((t) => R.clothing?.includes(t)));
    if (styled.length) pool = styled;
    else opts.notes.push('Выбранный стиль одежды не подходит к этой погоде и месту — подобрана другая одежда.');
  }
  if (opts.avoidId && pool.length > 1) pool = pool.filter((o) => o.id !== opts.avoidId);
  const primary = scene.outfits[0] as OutfitTag;
  const rainy = scene.dress === 'out' && f.weather === 'rain';
  const snowy = scene.dress === 'out' && (f.weather === 'snow' || f.weather === 'frost');
  const night = f.time === 'dusk' || f.time === 'evening' || f.time === 'night';
  const needCenter = (need[0] + need[1]) / 2;
  const picked = rng.weighted(pool, (o) => {
    let w = 1;
    if (o.tags.includes(primary)) w *= 1.6;
    if (o.tags.includes('evening') && !night && primary !== 'evening') w *= 0.4;
    if (rainy) w *= o.rainwear ? 4 : 0.6;
    if (snowy && o.hood) w *= 1.5;
    w /= 1 + Math.abs((o.w[0] + o.w[1]) / 2 - needCenter) * 0.25;
    return R.temper(w);
  });
  const def = picked ?? rng.pick(pool);
  return { def, en: colorize(def.en, rng.fork('color')) };
}

export function accessoryCtx(scene: Scene, f: { season: Season; weather: Weather | null; time: TimeOfDay }, climate: Climate, def: OutfitDef, outfitEn: string): AccessoryCtx {
  const need = needOf(scene, f.season, f.weather, f.time, climate);
  const daylight = f.time === 'morning' || f.time === 'day' || f.time === 'golden-hour';
  const sunnyWeather = f.weather === 'clear' || f.weather === 'partly-cloudy' || f.weather === 'heat' || f.weather === 'windy' || f.weather === 'frost';
  return {
    season: f.season,
    weather: f.weather,
    time: f.time,
    env: scene.env,
    dress: scene.dress,
    need,
    tags: def.tags,
    outfitEn,
    outfitHood: !!def.hood,
    outfitRainwear: !!def.rainwear,
    sunny: daylight && sunnyWeather,
    outdoors: scene.env !== 'indoor',
  };
}

const ACCESSORY_COUNT_W: Record<'low' | 'medium' | 'high', number[]> = {
  low: [50, 40, 10],
  medium: [25, 45, 30],
  high: [15, 35, 35, 15],
};

export function pickAccessories(
  R: Resolved,
  rng: Rng,
  ctx: AccessoryCtx,
  opts: { actionHands: number; capture: Capture; keep?: readonly string[] | undefined },
): string[] {
  const freeHands = 2 - opts.actionHands - (isSelfie(opts.capture) ? 1 : 0);
  if (opts.keep) {
    const valid = opts.keep.filter((id) => (ACCESSORY_BY_ID.get(id)?.weight(ctx) ?? 0) > 0);
    const busy = opts.keep.reduce((n, id) => n + (ACCESSORY_BY_ID.get(id)?.hands ?? 0), 0);
    if (valid.length === opts.keep.length && busy <= freeHands) return [...opts.keep];
  }
  const weights = ACCESSORY_COUNT_W[R.detailLevel];
  let count = rng.weighted(
    weights.map((_, i) => i),
    (i) => weights[i] as number,
  ) ?? 0;
  const rainOutdoors = ctx.weather === 'rain' && ctx.env === 'outdoor' && ctx.dress === 'out';
  if (rainOutdoors && count === 0 && !ctx.outfitRainwear) count = 1;
  const chosen: string[] = [];
  let hands = freeHands;
  for (let i = 0; i < count; i++) {
    const excluded = new Set(chosen.flatMap((id) => ACCESSORY_BY_ID.get(id)?.excludes ?? []));
    const pick = rng.weighted(ACCESSORIES, (a) => {
      if (chosen.includes(a.id) || excluded.has(a.id) || a.hands > hands) return 0;
      if (a.excludes?.some((x) => chosen.includes(x))) return 0;
      return R.temper(a.weight(ctx));
    });
    if (!pick) break;
    chosen.push(pick.id);
    hands -= pick.hands;
  }
  return chosen;
}
