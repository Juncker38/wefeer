import { describe, expect, it } from 'vitest';
import { defaultSettings, normalizeSettings } from '../src/core/settings.ts';
import type { Settings } from '../src/core/settings.ts';
import type { Character, HistoryFeature, PhotoScenario } from '../src/core/types.ts';
import { AGE_MAX, AGE_MIN, CAPTURES, MODES, SEASONS } from '../src/core/vocab.ts';
import type { Capture } from '../src/core/vocab.ts';
import { randomizeSettings } from '../src/core/randomize.ts';
import { ALL_SCENES, SCENE_BY_ID } from '../src/data/scenes/index.ts';
import { runBatch } from '../src/engine/batch.ts';
import { countFeasibleScenes, explainConstraints } from '../src/engine/diversity.ts';
import { editScenario, generateScenario, keepFromLocks, rerollAspect } from '../src/engine/generate.ts';
import { editOptions } from '../src/engine/options.ts';
import { PARTIAL_FACE_ANGLES, isSelfie } from '../src/engine/rules.ts';
import { generateSeries } from '../src/engine/series.ts';
import { checkAgainstHistory, comboKey, featuresOf, similarity } from '../src/engine/similarity.ts';
import { validateScenario } from '../src/engine/validate.ts';
import { gen, seeds, settingsWith } from './helpers.ts';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

describe('детерминизм seed', () => {
  it('один seed и одни настройки дают идентичный сценарий', () => {
    for (const seed of seeds(30, 'DET')) {
      expect(clone(gen(seed).scenario)).toEqual(clone(gen(seed).scenario));
    }
  });

  it('seed влияет на результат, а не просто возвращается', () => {
    const ids = new Set(seeds(60, 'VAR').map((s) => gen(s).scenario.id));
    expect(ids.size).toBeGreaterThan(50);
  });

  it('воспроизведение по seed и номеру попытки не зависит от истории', () => {
    const history: HistoryFeature[] = [];
    for (let i = 0; i < 25; i++) {
      const r = gen(`REPRO-${i}`, undefined, { history });
      history.unshift(featuresOf(r.scenario));
      const again = gen(`REPRO-${i}`, undefined, { history: [], attempt: r.scenario.attempt });
      expect(clone(again.scenario)).toEqual(clone(r.scenario));
    }
  });

  it('настройки влияют на результат при том же seed', () => {
    const a = gen('SAME-1').scenario;
    const b = gen('SAME-1', (s) => (s.choices.season = { mode: 'manual', values: ['winter'] })).scenario;
    expect(b.season).toBe('winter');
    expect(clone(a)).not.toEqual(clone(b));
  });
});

describe('возраст, безопасность и физическая согласованность', () => {
  const variants: [string, (s: Settings) => void][] = [
    ['по умолчанию', () => undefined],
    ['лицо обязательно видно', (s) => (s.faceRequired = true)],
    ['формат 16:9', (s) => (s.ratio = { mode: 'preset', preset: '16:9', custom: s.ratio.custom })],
    ['формат 21:9', (s) => (s.ratio = { mode: 'preset', preset: '21:9', custom: s.ratio.custom })],
    ['горизонтальная ориентация', (s) => (s.orientation = 'horizontal')],
    ['только селфи', (s) => Object.assign(s.captureShares, { 'by-acquaintance': 0, 'by-friend-walk': 0, candid: 0, 'tripod-timer': 0 })],
    ['только чужая съёмка', (s) => Object.assign(s.captureShares, { 'selfie-arm': 0, 'selfie-mirror': 0, 'selfie-reflection': 0, 'front-camera': 0 })],
    ['тёплый климат', (s) => (s.climate = 'warm')],
    ['холодный климат', (s) => (s.climate = 'cold')],
    ['зима', (s) => (s.choices.season = { mode: 'manual', values: ['winter'] })],
    ['лето и жара', (s) => {
      s.choices.season = { mode: 'manual', values: ['summer'] };
      s.choices.weather = { mode: 'manual', values: ['heat'] };
    }],
    ['ночь', (s) => (s.choices.time = { mode: 'manual', values: ['night'] })],
    ['золотой час', (s) => (s.choices.time = { mode: 'manual', values: ['golden-hour'] })],
    ['дождь', (s) => (s.choices.weather = { mode: 'manual', values: ['rain'] })],
    ['без людей на фоне', (s) => (s.backgroundPeople = false)],
    ['грусть разрешена', (s) => (s.allowSadEmotions = true)],
    ['возраст 45', (s) => (s.age = { min: 20, max: 45, exact: 45 })],
    ['возраст 20', (s) => (s.age = { min: 20, max: 45, exact: 20 })],
    ['полный рандом', (s) => (s.mode = 'chaos')],
  ];

  it.each(variants)('2×60 сценариев без противоречий: %s', (_name, patch) => {
    for (const seed of seeds(60, 'VAL')) {
      const r = gen(seed, patch);
      const sc = r.scenario;
      const issues = validateScenario(sc, { faceRequired: false, allowSad: true });
      expect(issues, `${seed}: ${issues.map((i) => i.message).join(' | ')}`).toEqual([]);
      expect(sc.subject.age).toBeGreaterThanOrEqual(AGE_MIN);
      expect(sc.subject.age).toBeLessThanOrEqual(AGE_MAX);
    }
  });

  it('возраст всегда целый и в диапазоне 20–45 для сотен сценариев и всех режимов', () => {
    const ages = new Set<number>();
    for (const mode of MODES) {
      for (const seed of seeds(120, `AGE-${mode}`)) {
        const sc = gen(seed, (s) => (s.mode = mode)).scenario;
        expect(Number.isInteger(sc.subject.age)).toBe(true);
        expect(sc.subject.age).toBeGreaterThanOrEqual(20);
        expect(sc.subject.age).toBeLessThanOrEqual(45);
        ages.add(sc.subject.age);
      }
    }
    expect(Math.min(...ages)).toBeLessThanOrEqual(22);
    expect(Math.max(...ages)).toBeGreaterThanOrEqual(40);
  });

  it('распределение возраста с пиком 25–33, но без исключения остальных', () => {
    let peak = 0;
    let other = 0;
    for (const seed of seeds(1500, 'PEAK')) {
      const a = gen(seed).scenario.subject.age;
      if (a >= 25 && a <= 33) peak++;
      else other++;
    }
    // Диапазон 25–33 — это 9 из 26 возрастов (35 %); с пиком их заметно больше.
    expect(peak / (peak + other)).toBeGreaterThan(0.45);
    expect(other).toBeGreaterThan(300);
  });

  it('точный возраст и диапазон соблюдаются', () => {
    for (const seed of seeds(40, 'EX')) expect(gen(seed, (s) => (s.age = { min: 20, max: 45, exact: 37 })).scenario.subject.age).toBe(37);
    for (const seed of seeds(80, 'RG')) {
      const a = gen(seed, (s) => (s.age = { min: 30, max: 33, exact: null })).scenario.subject.age;
      expect(a).toBeGreaterThanOrEqual(30);
      expect(a).toBeLessThanOrEqual(33);
    }
  });

  it('всегда ровно одна героиня: в сценарии нет второго главного персонажа', () => {
    for (const seed of seeds(80, 'ONE')) {
      const sc = gen(seed).scenario;
      expect(['none', 'incidental']).toContain(sc.crowd);
    }
  });

  it('без людей на фоне ни одна сцена не требует толпы', () => {
    for (const seed of seeds(120, 'NOCROWD')) {
      const sc = gen(seed, (s) => (s.backgroundPeople = false)).scenario;
      expect(sc.crowd).toBe('none');
      expect(SCENE_BY_ID.get(sc.sceneId)?.crowd).not.toBe(2);
    }
  });
});

describe('съёмка, ракурсы и формат', () => {
  it('селфи не бывает со спины и снятым другим человеком; руки хватает', () => {
    for (const seed of seeds(300, 'SELFIE')) {
      const sc = gen(seed, (s) => Object.assign(s.captureShares, { 'selfie-arm': 40, 'selfie-mirror': 20, 'selfie-reflection': 10, 'front-camera': 30, 'tripod-timer': 0, 'by-acquaintance': 0, 'by-friend-walk': 0, candid: 0 })).scenario;
      expect(isSelfie(sc.capture)).toBe(true);
      expect(sc.angle).not.toBe('back-head-turn');
      expect(sc.angle).not.toBe('profile');
      expect(sc.action.hands).toBeLessThanOrEqual(1);
      expect(sc.action.back).toBe(false);
      expect(sc.gaze === 'camera' || sc.gaze === 'down').toBe(true);
      expect(sc.ratio.orientation).not.toBe('horizontal');
      if (sc.capture === 'selfie-mirror') expect(SCENE_BY_ID.get(sc.sceneId)?.mirror).toBe(true);
      if (sc.capture === 'selfie-reflection') expect(SCENE_BY_ID.get(sc.sceneId)?.glass).toBe(true);
      expect(['close-up', 'portrait', 'waist-up', 'full-body', 'seated']).toContain(sc.framing);
      if (sc.capture === 'selfie-arm' || sc.capture === 'front-camera') expect(sc.framing).not.toBe('full-body');
    }
  });

  it('при «Лицо обязательно видно» нет ракурсов с частично скрытым лицом', () => {
    for (const seed of seeds(300, 'FACE')) {
      const sc = gen(seed, (s) => (s.faceRequired = true)).scenario;
      expect(PARTIAL_FACE_ANGLES).not.toContain(sc.angle);
      expect(sc.faceVisibility).toBe('full');
      expect(sc.action.hidden).toBe(false);
    }
  });

  it('видимость лица согласована с ракурсом', () => {
    for (const seed of seeds(200, 'VIS')) {
      const sc = gen(seed).scenario;
      expect(sc.faceVisibility).toBe(PARTIAL_FACE_ANGLES.includes(sc.angle) ? 'partial' : 'full');
    }
  });

  it('ручной формат соблюдается; метка, ориентация и пропорции согласованы', () => {
    for (const id of ['9:16', '16:9', '4:3', '3:4', '1:1', '4:5', '5:4', '2:3', '3:2', '21:9'] as const) {
      for (const seed of seeds(25, `R-${id}`)) {
        const sc = gen(seed, (s) => (s.ratio = { mode: 'preset', preset: id, custom: s.ratio.custom })).scenario;
        expect(sc.ratio.label).toBe(id);
        expect(sc.ratio.orientation).toBe(sc.ratio.w > sc.ratio.h ? 'horizontal' : sc.ratio.w < sc.ratio.h ? 'vertical' : 'square');
        if (sc.ratio.w / sc.ratio.h >= 1.9) expect(['full-body', 'in-motion', 'seated']).toContain(sc.framing);
        if (sc.ratio.orientation === 'horizontal') expect(isSelfie(sc.capture)).toBe(false);
      }
    }
  });

  it('пользовательское соотношение сторон сохраняется как есть', () => {
    for (const seed of seeds(40, 'CUSTOM')) {
      const sc = gen(seed, (s) => (s.ratio = { mode: 'custom', preset: '9:16', custom: { w: 7, h: 10 } })).scenario;
      expect(sc.ratio.label).toBe('7:10');
      expect(sc.ratio.orientation).toBe('vertical');
    }
  });

  it('ориентация: вертикальная и горизонтальная фильтруют форматы', () => {
    for (const seed of seeds(60, 'ORI')) {
      expect(gen(seed, (s) => (s.orientation = 'vertical')).scenario.ratio.orientation).toBe('vertical');
      expect(gen(seed, (s) => (s.orientation = 'horizontal')).scenario.ratio.orientation).toBe('horizontal');
    }
  });

  it('выбранные ракурс и кадрирование соблюдаются, когда возможны', () => {
    for (const seed of seeds(60, 'ANG')) {
      const sc = gen(seed, (s) => {
        s.choices.angle = { mode: 'manual', values: ['three-quarter'] };
        s.choices.framing = { mode: 'manual', values: ['waist-up'] };
      }).scenario;
      expect(sc.angle).toBe('three-quarter');
      expect(sc.framing).toBe('waist-up');
    }
  });

  it('грусть и слёзы по умолчанию исключены', () => {
    for (const seed of seeds(300, 'EMO')) expect(['sad', 'crying']).not.toContain(gen(seed).scenario.emotion);
  });

  it('смена типов съёмки по долям: нулевая доля никогда не выпадает', () => {
    const zero: Capture[] = ['candid', 'by-friend-walk'];
    for (const seed of seeds(200, 'SHARE')) {
      const sc = gen(seed, (s) => zero.forEach((c) => (s.captureShares[c] = 0))).scenario;
      expect(zero).not.toContain(sc.capture);
    }
  });

  it('по умолчанию селфи частые, но не единственные', () => {
    let selfies = 0;
    const kinds = new Set<Capture>();
    for (const seed of seeds(600, 'MIX')) {
      const c = gen(seed).scenario.capture;
      kinds.add(c);
      if (isSelfie(c)) selfies++;
    }
    expect(selfies / 600).toBeGreaterThan(0.25);
    expect(selfies / 600).toBeLessThan(0.8);
    expect(kinds.size).toBe(CAPTURES.length);
  });
});

describe('сезон, погода, время и одежда', () => {
  it('по умолчанию встречаются все сезоны', () => {
    const seen = new Set(seeds(200, 'SEA').map((s) => gen(s).scenario.season));
    expect(seen.size).toBe(SEASONS.length);
  });

  it('ручной выбор сезона, погоды и времени соблюдается', () => {
    for (const seed of seeds(50, 'MAN')) {
      const sc = gen(seed, (s) => {
        s.choices.season = { mode: 'manual', values: ['autumn'] };
        s.choices.time = { mode: 'manual', values: ['evening'] };
      }).scenario;
      expect(sc.season).toBe('autumn');
      expect(sc.time).toBe('evening');
    }
  });

  it('исключение работает: исключённый сезон не выпадает', () => {
    for (const seed of seeds(120, 'EXC')) {
      expect(gen(seed, (s) => (s.choices.season = { mode: 'exclude', values: ['winter', 'summer'] })).scenario.season).not.toMatch(/winter|summer/);
    }
  });

  it('снег и мороз возможны только в подходящем климате', () => {
    for (const seed of seeds(200, 'WARM')) {
      const sc = gen(seed, (s) => (s.climate = 'warm')).scenario;
      expect(sc.weather === 'snow' || sc.weather === 'frost').toBe(false);
    }
  });

  it('купальник и лыжная одежда не попадают в неподходящие условия', () => {
    for (const seed of seeds(400, 'WEAR')) {
      const sc = gen(seed).scenario;
      // Купальник зимой возможен только в закрытом помещении (бассейн), на улице — в тёплые сезоны.
      if (sc.outfit.tags.includes('swim') && sc.env !== 'indoor') expect(['summer', 'spring', 'autumn']).toContain(sc.season);
      if (sc.outfit.tags.includes('ski')) {
        expect(sc.season).toBe('winter');
        expect(['snow', 'frost', 'clear', 'partly-cloudy', 'overcast', 'fog', 'windy']).toContain(sc.weather);
      }
      if (sc.weather === 'heat' && sc.dress === 'out') expect(sc.outfit.id).not.toMatch(/parka|puffer|padded/);
    }
  });

  it('при ручном выборе «нет подходящей сцены» движок возвращает понятное объяснение', () => {
    const out = generateScenario({
      settings: settingsWith((s) => {
        s.choices.season = { mode: 'manual', values: ['summer'] };
        s.choices.weather = { mode: 'manual', values: ['snow'] };
      }),
      seed: 'IMPOSSIBLE',
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toMatch(/локаци/);
      expect(out.hints.length).toBeGreaterThan(0);
    }
  });
});

describe('закрепление параметров (lock)', () => {
  it('закреплённые параметры остаются неизменными, остальные меняются', () => {
    const first = gen('LOCK-0').scenario;
    const settings = settingsWith((s) => (s.locks = ['scene', 'season', 'outfit', 'hair', 'age']));
    let changed = 0;
    for (let i = 1; i <= 25; i++) {
      const out = generateScenario({ settings, seed: `LOCK-${i}`, prev: first });
      expect(out.ok).toBe(true);
      if (!out.ok) continue;
      const sc = out.result.scenario;
      expect(sc.sceneId).toBe(first.sceneId);
      expect(sc.season).toBe(first.season);
      expect(sc.outfit.id).toBe(first.outfit.id);
      expect(sc.outfit.en).toBe(first.outfit.en);
      expect(sc.subject.age).toBe(first.subject.age);
      expect(sc.subject.hairColor).toBe(first.subject.hairColor);
      expect(sc.subject.hairStyle).toBe(first.subject.hairStyle);
      expect(sc.locks).toEqual(expect.arrayContaining(['scene', 'season', 'outfit']));
      if (sc.capture !== first.capture || sc.angle !== first.angle || sc.emotion !== first.emotion) changed++;
      expect(validateScenario(sc)).toEqual([]);
    }
    expect(changed).toBeGreaterThan(10);
  });

  it('закрепление позы тянет за собой локацию; закрепление погоды и времени держится', () => {
    const first = gen('LOCK2-0').scenario;
    const keep = keepFromLocks(first, new Set(['action']));
    expect(keep.sceneId).toBe(first.sceneId);
    expect(keep.actionId).toBe(first.action.id);
    for (let i = 1; i <= 15; i++) {
      const out = generateScenario({ settings: settingsWith((s) => (s.locks = ['weather', 'time'])), seed: `LOCK2-${i}`, prev: first });
      expect(out.ok).toBe(true);
      if (!out.ok) continue;
      const sc = out.result.scenario;
      expect(sc.time).toBe(first.time);
      if (first.weather !== null && sc.weatherMode !== 'irrelevant') expect(sc.weather).toBe(first.weather);
    }
  });

  it('несовместимые закрепления ослабляются с объяснением, а не ломают генерацию', () => {
    const first = gen('LOCK3-0', (s) => (s.choices.season = { mode: 'manual', values: ['winter'] })).scenario;
    const settings = settingsWith((s) => {
      s.locks = ['scene', 'season'];
      s.climate = 'warm';
    });
    const out = generateScenario({ settings, seed: 'LOCK3-1', prev: first });
    expect(out.ok).toBe(true);
    if (out.ok) expect(validateScenario(out.result.scenario)).toEqual([]);
  });

  it('при полном рандоме закрепления и ручные ограничения игнорируются, возраст сохраняется', () => {
    const first = gen('CH-0').scenario;
    for (let i = 0; i < 30; i++) {
      const out = generateScenario({
        settings: settingsWith((s) => {
          s.mode = 'chaos';
          s.locks = ['scene', 'season'];
          s.choices.season = { mode: 'manual', values: ['winter'] };
          s.age = { min: 20, max: 22, exact: null };
        }),
        seed: `CH-${i + 1}`,
        prev: first,
      });
      expect(out.ok).toBe(true);
      if (!out.ok) continue;
      expect(out.result.scenario.locks).toEqual([]);
      expect(out.result.scenario.subject.age).toBeLessThanOrEqual(22);
    }
    const seen = new Set(seeds(80, 'CHS').map((s) => gen(s, (st) => {
      st.mode = 'chaos';
      st.choices.season = { mode: 'manual', values: ['winter'] };
    }).scenario.season));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('смена одного аспекта и правка сценария', () => {
  const aspects = ['scene', 'action', 'season', 'weather', 'time', 'capture', 'framing', 'angle', 'emotion', 'outfit', 'subject', 'details', 'ratio'] as const;

  it.each(aspects)('смена аспекта «%s» даёт корректный кадр и меняет именно его', (aspect) => {
    let changed = 0;
    let tried = 0;
    for (const seed of seeds(25, `RR-${aspect}`)) {
      const sc = gen(seed).scenario;
      if (aspect === 'weather' && sc.weather === null) continue;
      tried++;
      const out = rerollAspect({ settings: defaultSettings(), scenario: sc, aspect, salt: '1' });
      expect(out.ok, `${seed} ${aspect}`).toBe(true);
      if (!out.ok) continue;
      const n = out.result.scenario;
      expect(validateScenario(n), `${seed} ${aspect}`).toEqual([]);
      const diff: Record<(typeof aspects)[number], boolean> = {
        scene: n.sceneId !== sc.sceneId,
        action: n.action.id !== sc.action.id,
        season: n.season !== sc.season,
        weather: n.weather !== sc.weather,
        time: n.time !== sc.time,
        capture: n.capture !== sc.capture,
        framing: n.framing !== sc.framing,
        angle: n.angle !== sc.angle,
        emotion: n.emotion !== sc.emotion,
        outfit: n.outfit.id !== sc.outfit.id,
        subject: n.subject.hairColor !== sc.subject.hairColor || n.subject.age !== sc.subject.age || n.subject.eyeColor !== sc.subject.eyeColor,
        details: JSON.stringify(n.details) !== JSON.stringify(sc.details) || JSON.stringify(n.fg) !== JSON.stringify(sc.fg),
        ratio: n.ratio.label !== sc.ratio.label,
      };
      if (diff[aspect]) changed++;
      if (aspect === 'weather' || aspect === 'emotion' || aspect === 'angle' || aspect === 'time') expect(n.sceneId).toBe(sc.sceneId);
      if (aspect !== 'subject') expect(n.subject).toEqual(sc.subject);
      expect(n.seed).toBe(sc.seed);
    }
    expect(changed).toBeGreaterThanOrEqual(Math.floor(tried * 0.6));
  });

  it('сменить погоду в помещении без окон нельзя — сообщение понятное', () => {
    const scene = ALL_SCENES.find((s) => s.weatherMode === 'irrelevant');
    if (!scene) return;
    const sc = gen('RRW', (s) => (s.choices.scene = { mode: 'manual', values: [scene.id] })).scenario;
    const out = rerollAspect({ settings: defaultSettings(), scenario: sc, aspect: 'weather', salt: '1' });
    expect(out.ok).toBe(false);
  });

  it('редактирование: допустимая правка применяется и проверяется, недопустимая отклоняется', () => {
    let applied = 0;
    let rejected = 0;
    for (const seed of seeds(40, 'EDIT')) {
      const sc = gen(seed).scenario;
      const opts = editOptions(defaultSettings(), sc, 'capture');
      for (const o of opts.filter((x) => x.value !== sc.capture)) {
        const out = editScenario(defaultSettings(), sc, { capture: o.value as Capture });
        if (o.ok) {
          expect(out.ok, `${seed} ${o.value}`).toBe(true);
          if (out.ok) {
            expect(out.result.scenario.capture).toBe(o.value);
            expect(validateScenario(out.result.scenario)).toEqual([]);
            applied++;
          }
        } else {
          expect(out.ok).toBe(false);
          rejected++;
        }
      }
    }
    expect(applied).toBeGreaterThan(20);
    expect(rejected).toBeGreaterThan(10);
  });

  it('правка локации подстраивает остальное и сохраняет внешность', () => {
    const sc = gen('EDIT-SCENE').scenario;
    const target = ALL_SCENES.find((s) => s.id !== sc.sceneId && s.seasons.includes(sc.season));
    expect(target).toBeDefined();
    const out = editScenario(defaultSettings(), sc, { sceneId: target?.id });
    if (out.ok) {
      expect(out.result.scenario.sceneId).toBe(target?.id);
      expect(out.result.scenario.subject).toEqual(sc.subject);
      expect(validateScenario(out.result.scenario)).toEqual([]);
    }
  });
});

describe('антидубликаты', () => {
  it('в окне истории нет повторов «локация + поза + съёмка + одежда»', () => {
    const history: HistoryFeature[] = [];
    const all: PhotoScenario[] = [];
    for (let i = 0; i < 120; i++) {
      const r = gen(`DUP-${i}`, undefined, { history });
      history.unshift(featuresOf(r.scenario));
      all.push(r.scenario);
    }
    for (let i = 0; i < all.length; i++) {
      const keys = new Set<string>();
      for (let j = Math.max(0, i - 50); j <= i; j++) {
        const k = comboKey(featuresOf(all[j] as PhotoScenario));
        expect(keys.has(k)).toBe(false);
        keys.add(k);
      }
    }
    const scenes = new Set(all.map((s) => s.sceneId));
    expect(scenes.size).toBeGreaterThan(90);
    const cats = new Set(all.map((s) => s.category));
    expect(cats.size).toBe(7);
  });

  it('сходство: одинаковые кадры дают 1, разные — заметно меньше', () => {
    const a = featuresOf(gen('SIM-A').scenario);
    expect(similarity(a, a)).toBeCloseTo(1);
    const b = featuresOf(gen('SIM-B').scenario);
    expect(similarity(a, b)).toBeLessThan(0.7);
    expect(checkAgainstHistory(a, [a], 10).exact).toBe(true);
    expect(checkAgainstHistory(a, [a], 0).score).toBe(0);
  });

  it('при слишком жёстких ограничениях движок не зависает и объясняет повторы', () => {
    const only = ALL_SCENES.find((s) => s.actions.length >= 2);
    expect(only).toBeDefined();
    const settings = settingsWith((s) => {
      s.choices.scene = { mode: 'manual', values: [only?.id ?? ''] };
      s.choices.season = { mode: 'manual', values: [only?.seasons[0] ?? 'summer'] };
      s.dupWindow = 100;
      s.balance = 'variety';
    });
    const history: HistoryFeature[] = [];
    let strict = 0;
    for (let i = 0; i < 40; i++) {
      const out = generateScenario({ settings, seed: `STRICT-${i}`, history });
      expect(out.ok).toBe(true);
      if (!out.ok) continue;
      history.unshift(featuresOf(out.result.scenario));
      if (out.result.diversity.tooStrict) {
        strict++;
        expect(out.result.diversity.message).toMatch(/ограничения|Повторы неизбежны/);
        expect(out.result.diversity.attempts).toBeLessThanOrEqual(40);
      }
    }
    expect(strict).toBeGreaterThan(0);
  });

  it('режимы баланса меняют порог схожести, реализм отключить нельзя', () => {
    for (const balance of ['variety', 'balanced', 'realism'] as const) {
      for (const seed of seeds(40, `BAL-${balance}`)) {
        expect(validateScenario(gen(seed, (s) => (s.balance = balance)).scenario)).toEqual([]);
      }
    }
    const out = gen('BAL-T', (s) => (s.balance = 'variety')).diversity.threshold;
    const out2 = gen('BAL-T', (s) => (s.balance = 'realism')).diversity.threshold;
    expect(out).toBeLessThan(out2);
  });

  it('объяснение ограничений: число локаций уменьшается при фильтрах', () => {
    const base = countFeasibleScenes(defaultSettings());
    expect(base).toBe(ALL_SCENES.length - ALL_SCENES.filter((s) => s.crowd === 2).length * 0);
    const narrow = settingsWith((s) => {
      s.choices.season = { mode: 'manual', values: ['winter'] };
      s.choices.category = { mode: 'manual', values: ['home'] };
    });
    const n = countFeasibleScenes(narrow);
    expect(n).toBeLessThan(base);
    const rep = explainConstraints(narrow);
    expect(rep.feasibleScenes).toBe(n);
    expect(rep.families.length).toBeGreaterThan(0);
    expect(rep.families[0]?.gain ?? 0).toBeGreaterThan(0);
  });
});

describe('режимы генерации', () => {
  it('«Один персонаж»: внешность стабильна, сценарий меняется', () => {
    const ch: Character = { id: 'CH-TEST', name: 'Тест', subject: gen('CHAR-BASE').scenario.subject, createdAt: 0 };
    const kinds = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const out = generateScenario({ settings: settingsWith((s) => (s.mode = 'character')), seed: `CHAR-${i}`, character: ch });
      expect(out.ok).toBe(true);
      if (!out.ok) continue;
      const p = out.result.scenario.subject;
      expect(p.age).toBe(ch.subject.age);
      expect(p.hairColor).toBe(ch.subject.hairColor);
      expect(p.eyeColor).toBe(ch.subject.eyeColor);
      expect(p.skinTone).toBe(ch.subject.skinTone);
      expect(p.build).toBe(ch.subject.build);
      expect(out.result.scenario.characterId).toBe('CH-TEST');
      kinds.add(out.result.scenario.sceneId);
    }
    expect(kinds.size).toBeGreaterThan(25);
  });

  it('«Новая девушка»: внешность меняется от кадра к кадру', () => {
    const looks = new Set(seeds(40, 'NEW').map((s) => `${gen(s).scenario.subject.hairColor}|${gen(s).scenario.subject.eyeColor}|${gen(s).scenario.subject.age}`));
    expect(looks.size).toBeGreaterThan(25);
  });

  it('«Серия»: разные кадры одного персонажа без буквальных повторов', () => {
    for (const theme of ['auto', 'day-in-city', 'trip', 'weekend-home', 'outdoor-day'] as const) {
      const res = generateSeries({ settings: settingsWith((s) => ((s.mode = 'series'), (s.seriesTheme = theme))), seed: `SER-${theme}`, count: 8 });
      expect(res.scenarios.length).toBeGreaterThanOrEqual(7);
      const first = res.scenarios[0] as PhotoScenario;
      expect(new Set(res.scenarios.map((s) => s.sceneId)).size).toBe(res.scenarios.length);
      expect(new Set(res.scenarios.map((s) => comboKey(featuresOf(s)))).size).toBe(res.scenarios.length);
      for (const s of res.scenarios) {
        expect(s.subject.age).toBe(first.subject.age);
        expect(s.subject.hairColor).toBe(first.subject.hairColor);
        expect(s.subject.eyeColor).toBe(first.subject.eyeColor);
        expect(s.mode).toBe('series');
        expect(validateScenario(s)).toEqual([]);
      }
      expect(res.scenarios.filter((s) => s.season === first.season).length).toBeGreaterThanOrEqual(res.scenarios.length - 2);
    }
  });
});

describe('«Случайно всё»', () => {
  it('заполняет настройки корректно и оставляет достаточно локаций', () => {
    for (const seed of seeds(40, 'RND')) {
      const s = randomizeSettings(defaultSettings(), seed);
      expect(normalizeSettings(s).problems).toEqual([]);
      expect(countFeasibleScenes(s)).toBeGreaterThanOrEqual(5);
      expect(s.seed).toBe('');
      const out = generateScenario({ settings: s, seed });
      expect(out.ok).toBe(true);
    }
  });
});

describe('пакетная генерация', () => {
  const noPause = () => Promise.resolve();

  it('генерирует N кадров с прогрессом, воспроизводимо', async () => {
    const calls: number[] = [];
    const res = await runBatch({ settings: defaultSettings(), count: 30, baseSeed: 'BATCH', pause: noPause, onProgress: (d) => calls.push(d) });
    expect(res.scenarios).toHaveLength(30);
    expect(res.cancelled).toBe(false);
    expect(calls).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(res.scenarios.map((s) => s.index)).toEqual(Array.from({ length: 30 }, (_, i) => i));
    const again = await runBatch({ settings: defaultSettings(), count: 30, baseSeed: 'BATCH', pause: noPause });
    expect(again.scenarios.map((s) => s.id)).toEqual(res.scenarios.map((s) => s.id));
    for (const s of res.scenarios) expect(validateScenario(s)).toEqual([]);
    expect(new Set(res.scenarios.map((s) => s.sceneId)).size).toBeGreaterThan(25);
  });

  it('границы 1–100: меньше и больше допустимого зажимаются', async () => {
    expect((await runBatch({ settings: defaultSettings(), count: 0, baseSeed: 'B0', pause: noPause })).scenarios).toHaveLength(1);
    expect((await runBatch({ settings: defaultSettings(), count: 100, baseSeed: 'B100', pause: noPause })).scenarios).toHaveLength(100);
    expect((await runBatch({ settings: defaultSettings(), count: 5000, baseSeed: 'B5000', pause: noPause, yieldEvery: 50 })).scenarios).toHaveLength(100);
    expect((await runBatch({ settings: defaultSettings(), count: Number.NaN, baseSeed: 'BN', pause: noPause })).scenarios).toHaveLength(1);
  });

  it('отмена останавливает пакет и возвращает уже готовое', async () => {
    const ac = new AbortController();
    const res = await runBatch({
      settings: defaultSettings(),
      count: 50,
      baseSeed: 'BC',
      signal: ac.signal,
      pause: noPause,
      onProgress: (done) => {
        if (done === 7) ac.abort();
      },
    });
    expect(res.cancelled).toBe(true);
    expect(res.scenarios).toHaveLength(7);
  });

  it('уступает управление интерфейсу через заданные промежутки', async () => {
    let pauses = 0;
    await runBatch({ settings: defaultSettings(), count: 20, baseSeed: 'BP', yieldEvery: 5, pause: async () => void pauses++ });
    expect(pauses).toBe(4);
  });

  it('пакет в режиме серии собирает связанную серию', async () => {
    const res = await runBatch({ settings: settingsWith((s) => (s.mode = 'series')), count: 6, baseSeed: 'BS', pause: noPause });
    expect(res.title).toBeTruthy();
    expect(res.scenarios.length).toBeGreaterThanOrEqual(5);
  });
});

describe('проверка валидатора: ловит намеренно испорченные сценарии', () => {
  const base = gen('BAD-0', (s) => (s.choices.scene = { mode: 'manual', values: [ALL_SCENES.find((x) => x.mirror)?.id ?? ''] })).scenario;

  it('возраст вне диапазона и несовершеннолетний возраст', () => {
    for (const age of [17, 19, 46, 60, 20.5]) {
      const bad = clone(base);
      bad.subject.age = age;
      expect(validateScenario(bad).some((i) => i.code === 'age-range')).toBe(true);
    }
  });

  it('несовместимые параметры обнаруживаются', () => {
    const a = clone(base);
    a.capture = 'selfie-arm';
    a.angle = 'back-head-turn';
    expect(validateScenario(a).length).toBeGreaterThan(0);
    const b = clone(base);
    b.season = 'summer';
    b.weather = 'snow';
    expect(validateScenario(b).some((i) => i.aspect === 'weather')).toBe(true);
    const c = clone(base);
    c.time = 'night';
    c.weather = 'heat';
    expect(validateScenario(c).length).toBeGreaterThan(0);
    const d = clone(base);
    d.ratio = { w: 21, h: 9, label: '21:9', orientation: 'horizontal' };
    d.capture = 'selfie-arm';
    expect(validateScenario(d).some((i) => i.aspect === 'ratio')).toBe(true);
    const e = clone(base);
    e.detailLevel = 'low';
    e.details = ['snow melting on the doorstep'];
    expect(validateScenario(e).some((i) => i.aspect === 'details')).toBe(true);
  });
});
