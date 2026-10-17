import type { HistoryFeature, PhotoScenario } from '../core/types.ts';
import { shortHash } from './rng.ts';

export function featuresOf(s: PhotoScenario): HistoryFeature {
  return {
    sceneId: s.sceneId,
    category: s.category,
    actionId: s.action.id,
    capture: s.capture,
    framing: s.framing,
    angle: s.angle,
    outfitId: s.outfit.id,
    season: s.season,
    weather: s.weather,
    time: s.time,
    emotion: s.emotion,
    hairColor: s.subject.hairColor,
    age: s.subject.age,
  };
}

/** Ключ «локация + действие + тип съёмки + одежда». */
export function comboKey(f: HistoryFeature): string {
  return [f.sceneId, f.actionId, f.capture, f.outfitId].join('|');
}

/** Отпечаток ключевых параметров сценария. */
export function fingerprintOf(f: HistoryFeature): string {
  return shortHash([f.sceneId, f.actionId, f.capture, f.framing, f.angle, f.outfitId, f.season, f.time, f.weather ?? '-'].join('|'));
}

/** Сходство двух кадров от 0 (ничего общего) до 1 (одно и то же). */
export function similarity(a: HistoryFeature, b: HistoryFeature): number {
  let s = 0;
  if (a.sceneId === b.sceneId) {
    s += 0.3;
    if (a.actionId === b.actionId) s += 0.12;
  }
  if (a.category === b.category) s += 0.06;
  if (a.capture === b.capture) s += 0.1;
  if (a.framing === b.framing) s += 0.04;
  if (a.angle === b.angle) s += 0.04;
  if (a.outfitId === b.outfitId) s += 0.1;
  if (a.season === b.season) s += 0.05;
  if (a.time === b.time) s += 0.05;
  if (a.weather === b.weather) s += 0.04;
  if (a.emotion === b.emotion) s += 0.03;
  if (a.hairColor === b.hairColor) s += 0.04;
  if (Math.abs(a.age - b.age) <= 1) s += 0.03;
  return Math.min(1, s);
}

export interface DuplicateCheck {
  score: number;
  /** Точное совпадение комбинации «локация + действие + съёмка + одежда» в окне. */
  comboRepeat: boolean;
  exact: boolean;
}

/** Сравнение кандидата с недавней историей (новые записи — первыми). */
export function checkAgainstHistory(f: HistoryFeature, history: readonly HistoryFeature[], windowSize: number): DuplicateCheck {
  const recent = history.slice(0, Math.max(0, windowSize));
  const key = comboKey(f);
  const fp = fingerprintOf(f);
  let score = 0;
  let comboRepeat = false;
  let exact = false;
  for (const h of recent) {
    score = Math.max(score, similarity(f, h));
    if (comboKey(h) === key) comboRepeat = true;
    if (fingerprintOf(h) === fp) exact = true;
  }
  return { score, comboRepeat, exact };
}
