import type { Issue, PhotoScenario } from '../core/types.ts';
import { safetyProblems } from '../core/safety.ts';
import { AGE_MAX, AGE_MIN } from '../core/vocab.ts';
import { ACCESSORY_BY_ID } from '../data/accessories.ts';
import { FEATURE_BY_ID } from '../data/appearance.ts';
import { SCENE_BY_ID } from '../data/scenes/index.ts';
import { sunglassesPlausible, hairStylesFor } from './appearance.ts';
import { WEATHER_TABLE, weatherTimeOk } from './climate.ts';
import {
  angleReason,
  captureReason,
  faceVisibilityOf,
  framingReason,
  gazesFor,
  isSelfie,
  ratioReason,
} from './rules.ts';
import { detailAllowed } from './scenery.ts';
import { OUTFIT_BY_ID, accessoryCtx, needOf, outfitReason } from './wardrobe.ts';

export interface ValidateOptions {
  faceRequired?: boolean;
  allowSad?: boolean;
}

/** Независимая проверка готового сценария на физические и логические противоречия. */
export function validateScenario(s: PhotoScenario, opts: ValidateOptions = {}): Issue[] {
  const out: Issue[] = [];
  const add = (aspect: Issue['aspect'], code: string, message: string) => out.push({ aspect, code, message });

  const p = s.subject;
  if (!Number.isInteger(p.age) || p.age < AGE_MIN || p.age > AGE_MAX) add('subject', 'age-range', `Возраст ${p.age} вне диапазона ${AGE_MIN}–${AGE_MAX}.`);
  if (!hairStylesFor(p.hairLength).includes(p.hairStyle)) add('subject', 'hair-style', 'Причёска невозможна для такой длины волос.');
  for (const f of p.features) {
    const def = FEATURE_BY_ID.get(f);
    if (!def) add('subject', 'feature-unknown', `Неизвестная особенность «${f}».`);
    else if ((def.minAge ?? 0) > p.age) add('subject', 'feature-age', 'Особенность не соответствует возрасту.');
  }

  const scene = SCENE_BY_ID.get(s.sceneId);
  if (!scene) {
    add('scene', 'scene-unknown', `Локация «${s.sceneId}» не найдена в библиотеке.`);
    return out;
  }
  if (!scene.seasons.includes(s.season)) add('season', 'season-scene', 'Сезон не подходит для этой локации.');
  if (!scene.times.includes(s.time)) add('time', 'time-scene', 'Время суток не подходит для этой локации.');
  if (scene.weatherMode === 'irrelevant') {
    if (s.weather !== null) add('weather', 'weather-irrelevant', 'В помещении без окон погода не применима.');
  } else if (s.weather === null) {
    add('weather', 'weather-missing', 'Для этой локации нужна погода.');
  } else {
    if (!WEATHER_TABLE[s.climate][s.season][s.weather]) add('weather', 'weather-season', 'Такая погода невозможна в этом сезоне и климате.');
    if (scene.weatherMode === 'visible' && !scene.weathers.includes(s.weather)) add('weather', 'weather-scene', 'Такая погода невозможна в этой локации.');
  }
  if (!weatherTimeOk(s.weather, s.time)) add('time', 'weather-time', 'Время суток противоречит погоде.');
  if (scene.snowbound && !(s.season === 'winter' && s.climate !== 'warm')) add('season', 'snowbound', 'Для этой локации нужен снежный покров.');

  const action = scene.actions.find((a) => a.id === s.action.id);
  if (!action) {
    add('action', 'action-unknown', 'Действие не относится к этой локации.');
    return out;
  }

  const cr = captureReason(s.capture, scene, action);
  if (cr) add('capture', 'capture', cr);
  const fr = framingReason(s.framing, s.capture, action);
  if (fr) add('framing', 'framing', fr);
  const ar = angleReason(s.angle, s.capture, s.framing, action, scene, !!opts.faceRequired);
  if (ar) add('angle', 'angle', ar);
  const rr = ratioReason(s.ratio, s.capture, s.framing);
  if (rr) add('ratio', 'ratio', rr);
  if (s.ratio.w < 1 || s.ratio.h < 1) add('ratio', 'ratio-range', 'Некорректные пропорции кадра.');
  if (!gazesFor(s.capture, s.angle, action).includes(s.gaze)) add('gaze', 'gaze', 'Направление взгляда противоречит съёмке, ракурсу или действию.');
  if (s.faceVisibility !== faceVisibilityOf(s.angle)) add('angle', 'face-visibility', 'Видимость лица не соответствует ракурсу.');
  if (opts.faceRequired && s.faceVisibility !== 'full') add('angle', 'face-required', 'Лицо должно быть видно.');
  if (!opts.allowSad && (s.emotion === 'sad' || s.emotion === 'crying')) add('emotion', 'emotion-sad', 'Грусть и слёзы выключены в настройках.');

  const outfit = OUTFIT_BY_ID.get(s.outfit.id);
  if (!outfit) add('outfit', 'outfit-unknown', 'Одежда не найдена в библиотеке.');
  else {
    const need = needOf(scene, s.season, s.weather, s.time, s.climate);
    const r = outfitReason(outfit, scene, need, s.weather);
    if (r) add('outfit', 'outfit', r[0]?.toUpperCase() + r.slice(1) + '.');
    const facts = { season: s.season, weather: s.weather, time: s.time };
    const ctx = accessoryCtx(scene, facts, s.climate, outfit, s.outfit.en);
    let hands = 2 - action.hands - (isSelfie(s.capture) ? 1 : 0);
    for (const id of s.accessories) {
      const a = ACCESSORY_BY_ID.get(id);
      if (!a) {
        add('outfit', 'accessory-unknown', `Неизвестный аксессуар «${id}».`);
        continue;
      }
      if (a.weight(ctx) <= 0) add('outfit', 'accessory-context', `Аксессуар «${a.ru}» неуместен в этих условиях.`);
      hands -= a.hands;
    }
    if (hands < 0) add('outfit', 'hands', 'Не хватает рук: действие, телефон и аксессуары занимают больше двух рук.');
    if (p.glasses === 'sunglasses' && !sunglassesPlausible({ tags: outfit.tags, time: s.time, weather: s.weather, outdoors: scene.env !== 'indoor' })) {
      add('subject', 'sunglasses', 'Солнцезащитные очки неуместны: нет яркого дневного света на улице.');
    }
  }

  const facts = { season: s.season, weather: s.weather, time: s.time };
  for (const d of s.details) if (!detailAllowed(d, scene, facts)) add('details', 'detail-condition', `Деталь «${d}» не соответствует погоде, сезону или времени.`);
  for (const t of s.fg) if (!scene.fg.includes(t)) add('details', 'fg-unknown', 'Предмет переднего плана не из этой локации.');
  for (const t of s.mid) if (!scene.mid.includes(t)) add('details', 'mid-unknown', 'Предмет среднего плана не из этой локации.');
  for (const t of s.far) if (!scene.far.includes(t)) add('details', 'far-unknown', 'Предмет дальнего плана не из этой локации.');
  if (s.crowd === 'incidental' && scene.crowd === 0) add('details', 'crowd', 'В этой локации нет людей на фоне.');

  const text = [s.place, s.action.en, s.outfit.en, s.light, ...s.fg, ...s.mid, ...s.far, ...s.details, ...s.imperfections, ...p.features.map((f) => FEATURE_BY_ID.get(f)?.en ?? '')].join(' . ');
  for (const m of safetyProblems(text)) add('details', 'safety', `Безопасность: ${m}.`);
  return out;
}
