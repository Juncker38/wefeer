import type { Character, HistoryFeature, PhotoScenario, Subject } from '../core/types.ts';
import { L_LOCK } from '../core/labels.ts';
import type { Settings } from '../core/settings.ts';
import type { LockKey } from '../core/vocab.ts';
import type { SubjectKeep } from './appearance.ts';
import { composeFromPlan, preparePlan } from './compose.ts';
import type { ComposeContext, Keep } from './compose.ts';
import { resolveSettings } from './context.ts';
import type { Resolved } from './context.ts';
import { explainConstraints } from './diversity.ts';
import { checkAgainstHistory, featuresOf } from './similarity.ts';

export interface DiversityReport {
  attempts: number;
  similarity: number;
  threshold: number;
  accepted: boolean;
  tooStrict: boolean;
  message: string | null;
}

export interface GenerateInput {
  settings: Settings;
  seed: string;
  /** Предыдущий кадр — источник значений для закреплённых параметров. */
  prev?: PhotoScenario | null;
  /** Недавняя история (новые записи первыми) для контроля повторов. */
  history?: readonly HistoryFeature[];
  character?: Character | null;
  /** Принудительная внешность (серия кадров). */
  subjectOverride?: Subject | null;
  index?: number;
  /** Воспроизведение конкретной попытки: антидубликаты отключены. */
  attempt?: number;
  hard?: Keep;
  soft?: Keep;
  avoid?: Keep;
  /** Показываемый seed (для производных кадров — исходный). */
  seedLabel?: string;
}

export interface GenerateResult {
  scenario: PhotoScenario;
  diversity: DiversityReport;
}

export type GenerateOutcome = { ok: true; result: GenerateResult } | { ok: false; reason: string; hints: string[] };

export function subjectKeepAll(p: Subject): SubjectKeep {
  return {
    age: p.age,
    hair: { hairColor: p.hairColor, hairLength: p.hairLength, hairType: p.hairType, hairStyle: p.hairStyle },
    eyes: p.eyeColor,
    skin: p.skinTone,
    build: { build: p.build, height: p.height },
    face: { makeup: p.makeup, freckles: p.freckles, glasses: p.glasses, features: [...p.features] },
  };
}

/** Закреплённые параметры → жёсткие ограничения на новый кадр. */
export function keepFromLocks(prev: PhotoScenario, locks: ReadonlySet<LockKey>): Keep {
  const k: Keep = {};
  if (locks.has('scene') || locks.has('action')) k.sceneId = prev.sceneId;
  if (locks.has('season')) k.season = prev.season;
  if (locks.has('weather') && prev.weather !== null) k.weather = prev.weather;
  if (locks.has('time')) k.time = prev.time;
  if (locks.has('action')) k.actionId = prev.action.id;
  if (locks.has('capture')) k.capture = prev.capture;
  if (locks.has('framing')) k.framing = prev.framing;
  if (locks.has('angle')) k.angle = prev.angle;
  if (locks.has('emotion')) k.emotion = prev.emotion;
  if (locks.has('outfit')) {
    k.outfitId = prev.outfit.id;
    k.outfitEn = prev.outfit.en;
  }
  if (locks.has('ratio')) k.ratio = prev.ratio;
  const p = prev.subject;
  const sub: SubjectKeep = {};
  if (locks.has('age')) sub.age = p.age;
  if (locks.has('hair')) sub.hair = { hairColor: p.hairColor, hairLength: p.hairLength, hairType: p.hairType, hairStyle: p.hairStyle };
  if (locks.has('eyes')) sub.eyes = p.eyeColor;
  if (locks.has('skin')) sub.skin = p.skinTone;
  if (locks.has('build')) sub.build = { build: p.build, height: p.height };
  if (locks.has('face')) sub.face = { makeup: p.makeup, freckles: p.freckles, glasses: p.glasses, features: [...p.features] };
  if (Object.keys(sub).length) k.subject = sub;
  return k;
}

/** Все параметры кадра как мягкие предпочтения (для смены одного аспекта и правок). */
export function keepFromScenario(s: PhotoScenario): Keep {
  return {
    sceneId: s.sceneId,
    season: s.season,
    weather: s.weather,
    time: s.time,
    actionId: s.action.id,
    capture: s.capture,
    framing: s.framing,
    angle: s.angle,
    gaze: s.gaze,
    emotion: s.emotion,
    outfitId: s.outfit.id,
    outfitEn: s.outfit.en,
    ratio: s.ratio,
    accessories: [...s.accessories],
    details: [...s.details],
    fg: [...s.fg],
    mid: [...s.mid],
    far: [...s.far],
    imperfections: [...s.imperfections],
    hand: s.hand,
    subject: subjectKeepAll(s.subject),
  };
}

const DROP_ORDER: readonly (keyof Keep)[] = ['ratio', 'outfitId', 'emotion', 'angle', 'framing', 'capture', 'actionId', 'time', 'weather', 'season', 'sceneId'];
const KEY_LOCK: Partial<Record<keyof Keep, LockKey>> = {
  ratio: 'ratio',
  outfitId: 'outfit',
  emotion: 'emotion',
  angle: 'angle',
  framing: 'framing',
  capture: 'capture',
  actionId: 'action',
  time: 'time',
  weather: 'weather',
  season: 'season',
  sceneId: 'scene',
};

function relaxHard(R: Resolved, hard: Keep, notes: string[]): { hard: Keep; plan: ReturnType<typeof preparePlan> } {
  let h = { ...hard };
  let plan = preparePlan(R, h);
  for (const key of DROP_ORDER) {
    if (plan.candidates.length) break;
    if (h[key] === undefined) continue;
    const lock = KEY_LOCK[key];
    notes.push(`Закрепление «${lock ? L_LOCK[lock] : String(key)}» снято: оно несовместимо с остальными ограничениями.`);
    const { [key]: _drop, ...rest } = h;
    void _drop;
    h = rest as Keep;
    if (key === 'outfitId') delete h.outfitEn;
    plan = preparePlan(R, h);
  }
  return { hard: h, plan };
}

function failure(R: Resolved): GenerateOutcome {
  const report = explainConstraints(R.settings);
  return {
    ok: false,
    reason: 'Нет ни одной локации, совместимой с текущими настройками.',
    hints: report.messages.length ? report.messages : ['Ослабьте ручные ограничения (сезон, погода, ракурс, типы съёмки) или снимите закрепления.'],
  };
}

export function generateScenario(input: GenerateInput): GenerateOutcome {
  const R = resolveSettings(input.settings);
  const notes = [...R.notes];
  const prev = input.prev ?? null;
  const lockHard = !R.chaos && prev ? keepFromLocks(prev, R.locks) : {};
  const { plan } = relaxHard(R, { ...lockHard, ...input.hard }, notes);
  if (!plan.candidates.length) return failure(R);

  const appliedLocks: LockKey[] = !R.chaos && prev ? [...R.locks].filter((l) => !notes.some((n) => n.includes(`«${L_LOCK[l]}» снято`))) : [];
  const history = input.history ?? [];
  const forced = input.attempt !== undefined;
  const maxAttempts = forced ? 1 : R.maxAttempts;
  const start = input.attempt ?? 0;
  const base: Subject | null = input.subjectOverride ?? (R.settings.mode === 'character' && input.character ? input.character.subject : null);
  const characterId = input.subjectOverride ? (input.character?.id ?? null) : R.settings.mode === 'character' && input.character ? input.character.id : null;

  // Недавние локации: повтор допускается, только если разумной замены не нашлось.
  const sceneWindow = Math.min(R.dupWindow, 30, Math.floor(plan.candidates.length * 0.4));
  const recentScenes = new Set(history.slice(0, sceneWindow).map((h) => h.sceneId));

  let best: { s: PhotoScenario; score: number } | null = null;
  let accepted = false;
  let used = 0;
  for (let i = 0; i < maxAttempts; i++) {
    const attempt = start + i;
    const cx: ComposeContext = {
      seed: `${input.seed}#${attempt}`,
      seedLabel: input.seedLabel ?? input.seed,
      attempt,
      soft: input.soft ?? {},
      avoid: input.avoid ?? {},
      base,
      characterId,
      index: input.index ?? 0,
      mode: R.settings.mode,
      notes,
      appliedLocks,
    };
    const s = composeFromPlan(plan, cx);
    used += 1;
    if (!s) continue;
    if (forced) {
      best = { s, score: 0 };
      accepted = true;
      break;
    }
    const check = checkAgainstHistory(featuresOf(s), history, R.dupWindow);
    const duplicate = check.comboRepeat || check.exact || check.score >= R.dupThreshold;
    const repeatedScene = recentScenes.has(s.sceneId);
    const rank = (duplicate ? 10 : 0) + (repeatedScene ? 1 : 0) + check.score;
    if (!best || rank < best.score) best = { s, score: rank };
    if (!duplicate && !repeatedScene) {
      accepted = true;
      break;
    }
  }
  if (!best) return failure(R);
  accepted = accepted || best.score < 10;
  const check = checkAgainstHistory(featuresOf(best.s), history, R.dupWindow);
  const tooStrict = !accepted;
  let message: string | null = null;
  if (tooStrict) {
    const report = explainConstraints(R.settings);
    message = `Не удалось подобрать заметно отличающийся кадр за ${used} попыток: при таких ограничениях доступно сцен — ${report.feasibleScenes}. Повторы неизбежны — расширьте выбор или снимите закрепления.`;
    best.s.notes.push(message);
  }
  return {
    ok: true,
    result: {
      scenario: best.s,
      diversity: { attempts: used, similarity: check.score, threshold: R.dupThreshold, accepted, tooStrict, message },
    },
  };
}

// ───────── Смена одного аспекта ─────────

export const REROLL_ASPECTS = ['scene', 'action', 'season', 'weather', 'time', 'capture', 'framing', 'angle', 'emotion', 'outfit', 'subject', 'details', 'ratio'] as const;
export type RerollAspect = (typeof REROLL_ASPECTS)[number];

export const REROLL_LABELS: Record<RerollAspect, string> = {
  scene: 'Сменить локацию',
  action: 'Сменить позу',
  season: 'Другой сезон',
  weather: 'Сменить погоду',
  time: 'Другое время суток',
  capture: 'Другой тип съёмки',
  framing: 'Другое кадрирование',
  angle: 'Другой ракурс',
  emotion: 'Другая эмоция',
  outfit: 'Другая одежда',
  subject: 'Другая внешность',
  details: 'Другие детали',
  ratio: 'Другой формат кадра',
};

const ASPECT_LOCK: Record<RerollAspect, LockKey[]> = {
  scene: ['scene', 'action'],
  action: ['action', 'scene'],
  season: ['season'],
  weather: ['weather'],
  time: ['time'],
  capture: ['capture'],
  framing: ['framing'],
  angle: ['angle'],
  emotion: ['emotion'],
  outfit: ['outfit'],
  subject: ['age', 'hair', 'eyes', 'skin', 'build', 'face'],
  details: [],
  ratio: ['ratio'],
};

/** Какие закрепления мешают сменить аспект. */
export function blockingLocks(settings: Settings, aspect: RerollAspect): LockKey[] {
  return ASPECT_LOCK[aspect].filter((l) => settings.locks.includes(l));
}

export interface RerollInput {
  settings: Settings;
  scenario: PhotoScenario;
  aspect: RerollAspect;
  salt: string;
  character?: Character | null;
}

export function rerollAspect(input: RerollInput): GenerateOutcome {
  const { scenario: s, aspect } = input;
  if (aspect === 'weather' && s.weather === null) {
    return { ok: false, reason: 'В этой локации погода не отображается — менять нечего.', hints: ['Смените локацию на улицу или помещение с окном.'] };
  }
  const soft = keepFromScenario(s);
  const avoid: Keep = {};
  switch (aspect) {
    case 'scene':
      delete soft.sceneId;
      delete soft.actionId;
      avoid.sceneId = s.sceneId;
      break;
    case 'action':
      delete soft.actionId;
      avoid.actionId = s.action.id;
      break;
    case 'season':
      delete soft.season;
      avoid.season = s.season;
      break;
    case 'weather':
      delete soft.weather;
      avoid.weather = s.weather;
      break;
    case 'time':
      delete soft.time;
      avoid.time = s.time;
      break;
    case 'capture':
      delete soft.capture;
      avoid.capture = s.capture;
      break;
    case 'framing':
      delete soft.framing;
      avoid.framing = s.framing;
      break;
    case 'angle':
      delete soft.angle;
      avoid.angle = s.angle;
      break;
    case 'emotion':
      delete soft.emotion;
      avoid.emotion = s.emotion;
      break;
    case 'outfit':
      delete soft.outfitId;
      delete soft.outfitEn;
      delete soft.accessories;
      avoid.outfitId = s.outfit.id;
      break;
    case 'subject':
      delete soft.subject;
      break;
    case 'details':
      delete soft.details;
      delete soft.fg;
      delete soft.mid;
      delete soft.far;
      delete soft.imperfections;
      break;
    case 'ratio':
      delete soft.ratio;
      avoid.ratio = s.ratio;
      break;
  }
  const out = generateScenario({
    settings: input.settings,
    seed: `${s.seed}~${aspect}-${input.salt}`,
    seedLabel: s.seed,
    prev: s,
    character: input.character ?? null,
    index: s.index,
    attempt: 0,
    soft,
    avoid,
    subjectOverride: aspect === 'subject' ? null : s.mode === 'character' || s.mode === 'series' ? s.subject : null,
  });
  if (out.ok) {
    out.result.scenario.attempt = s.attempt;
    out.result.scenario.notes.push(`Изменён аспект: ${REROLL_LABELS[aspect].toLowerCase()}.`);
  }
  return out;
}

// ───────── Редактирование сценария ─────────

export interface ScenarioPatch {
  sceneId?: string;
  season?: PhotoScenario['season'];
  weather?: PhotoScenario['weather'];
  time?: PhotoScenario['time'];
  actionId?: string;
  capture?: PhotoScenario['capture'];
  framing?: PhotoScenario['framing'];
  angle?: PhotoScenario['angle'];
  emotion?: PhotoScenario['emotion'];
  outfitId?: string;
  ratio?: PhotoScenario['ratio'];
}

/** Применяет правку пользователя как жёсткое требование; остальное подстраивается с проверкой совместимости. */
export function editScenario(settings: Settings, s: PhotoScenario, patch: ScenarioPatch, character?: Character | null): GenerateOutcome {
  const soft = keepFromScenario(s);
  const hard: Keep = {};
  for (const [k, v] of Object.entries(patch) as [keyof ScenarioPatch, unknown][]) {
    if (v === undefined) continue;
    (hard as Record<string, unknown>)[k] = v;
  }
  if (patch.sceneId && patch.sceneId !== s.sceneId) {
    delete soft.actionId;
    delete soft.details;
    delete soft.fg;
    delete soft.mid;
    delete soft.far;
  }
  if (patch.outfitId) delete soft.accessories;
  const keys = Object.keys(hard) as (keyof Keep)[];
  for (const k of keys) delete soft[k];
  const out = generateScenario({
    settings: { ...settings, locks: [] },
    seed: s.seed,
    seedLabel: s.seed,
    prev: null,
    character: character ?? null,
    index: s.index,
    attempt: 0,
    hard,
    soft,
    subjectOverride: s.mode === 'character' || s.mode === 'series' ? s.subject : null,
  });
  if (!out.ok) return out;
  const r = out.result.scenario;
  const honored =
    (patch.sceneId === undefined || r.sceneId === patch.sceneId) &&
    (patch.season === undefined || r.season === patch.season) &&
    (patch.weather === undefined || r.weather === patch.weather) &&
    (patch.time === undefined || r.time === patch.time) &&
    (patch.actionId === undefined || r.action.id === patch.actionId) &&
    (patch.capture === undefined || r.capture === patch.capture) &&
    (patch.framing === undefined || r.framing === patch.framing) &&
    (patch.angle === undefined || r.angle === patch.angle) &&
    (patch.emotion === undefined || r.emotion === patch.emotion) &&
    (patch.outfitId === undefined || r.outfit.id === patch.outfitId) &&
    (patch.ratio === undefined || r.ratio.label === patch.ratio.label);
  // Правка не должна молча подменять локацию или позу: для этого есть «Сменить …».
  const stable = (patch.sceneId !== undefined || r.sceneId === s.sceneId) && (patch.sceneId !== undefined || patch.actionId !== undefined || r.action.id === s.action.id);
  if (!honored || !stable) {
    return { ok: false, reason: 'Такая правка несовместима с остальными параметрами кадра.', hints: ['Измените другой параметр или используйте «Сменить …» для автоматического подбора.'] };
  }
  r.attempt = s.attempt;
  r.notes.push('Сценарий отредактирован вручную; совместимость пересчитана.');
  return out;
}
