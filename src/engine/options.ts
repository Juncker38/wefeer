import type { PhotoScenario } from '../core/types.ts';
import type { Settings } from '../core/settings.ts';
import { RATIO_PRESETS } from '../core/settings.ts';
import {
  L_ANGLE,
  L_CAPTURE,
  L_EMOTION,
  L_FRAMING,
  L_SEASON,
  L_TIME,
  L_WEATHER,
} from '../core/labels.ts';
import { ANGLES, CAPTURES, EMOTIONS, FRAMINGS, SEASONS, TIMES, WEATHERS } from '../core/vocab.ts';
import { ALL_SCENES, SCENE_BY_ID } from '../data/scenes/index.ts';
import { OUTFITS } from '../data/outfits.ts';
import { editScenario } from './generate.ts';
import type { ScenarioPatch } from './generate.ts';
import { angleReason, captureReason, framingReason } from './rules.ts';
import { needOf, outfitReason } from './wardrobe.ts';

export const EDIT_ASPECTS = ['scene', 'action', 'season', 'weather', 'time', 'capture', 'framing', 'angle', 'emotion', 'outfit', 'ratio'] as const;
export type EditAspect = (typeof EDIT_ASPECTS)[number];

export interface EditOption {
  value: string;
  label: string;
  ok: boolean;
  reason?: string;
}

const GENERIC = 'несовместимо с локацией или другими параметрами кадра';

/** Варианты для ручной правки: недоступные помечаются с объяснением причины. */
export function editOptions(settings: Settings, s: PhotoScenario, aspect: EditAspect): EditOption[] {
  const scene = SCENE_BY_ID.get(s.sceneId);
  const test = (patch: ScenarioPatch): { ok: boolean; reason?: string } => {
    const out = editScenario(settings, s, patch);
    return out.ok ? { ok: true } : { ok: false, reason: out.reason };
  };
  const make = (value: string, label: string, patch: ScenarioPatch, why?: string | null): EditOption => {
    if (why) return { value, label, ok: false, reason: why };
    const r = test(patch);
    return r.ok ? { value, label, ok: true } : { value, label, ok: false, reason: GENERIC };
  };
  if (!scene) return [];
  switch (aspect) {
    case 'scene':
      return ALL_SCENES.map((sc) => make(sc.id, sc.titleRu, { sceneId: sc.id }));
    case 'action':
      return scene.actions.map((a) => make(a.id, a.ru, { actionId: a.id }));
    case 'season':
      return SEASONS.map((v) => make(v, L_SEASON[v], { season: v }, scene.seasons.includes(v) ? null : 'сезон не подходит для этой локации'));
    case 'weather':
      return s.weather === null ? [] : WEATHERS.map((v) => make(v, L_WEATHER[v], { weather: v }, scene.weathers.includes(v) ? null : 'такая погода невозможна в этой локации'));
    case 'time':
      return TIMES.map((v) => make(v, L_TIME[v], { time: v }, scene.times.includes(v) ? null : 'время суток не подходит для этой локации'));
    case 'capture':
      return CAPTURES.map((v) => make(v, L_CAPTURE[v], { capture: v }, captureReason(v, scene, s.action)));
    case 'framing':
      return FRAMINGS.map((v) => make(v, L_FRAMING[v], { framing: v }, framingReason(v, s.capture, s.action)));
    case 'angle':
      return ANGLES.map((v) => make(v, L_ANGLE[v], { angle: v }, angleReason(v, s.capture, s.framing, s.action, scene, settings.faceRequired)));
    case 'emotion':
      return EMOTIONS.filter((e) => settings.allowSadEmotions || (e !== 'sad' && e !== 'crying')).map((v) => make(v, L_EMOTION[v], { emotion: v }));
    case 'outfit': {
      const need = needOf(scene, s.season, s.weather, s.time, s.climate);
      return OUTFITS.filter((o) => outfitReason(o, scene, need, s.weather) === null).map((o) => ({ value: o.id, label: o.ru, ok: true }));
    }
    case 'ratio':
      return RATIO_PRESETS.map((r) => make(r.label, r.label, { ratio: r }));
  }
}
