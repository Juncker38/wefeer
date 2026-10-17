import { describe, expect, it } from 'vitest';
import { defaultSettings, describeRatio, fixedRatio, isValidCustomRatio, normalizeSettings, ratioFromId } from '../src/core/settings.ts';
import { AGE_MAX, AGE_MIN, CAPTURES, RATIO_IDS } from '../src/core/vocab.ts';
import { createRng, makeSeed, normalizeShares } from '../src/engine/rng.ts';
import { ageWeight } from '../src/engine/appearance.ts';
import { safetyProblems } from '../src/core/safety.ts';

describe('генератор случайных чисел', () => {
  it('детерминирован: один seed — одна последовательность', () => {
    const a = createRng('seed-1');
    const b = createRng('seed-1');
    const xs = Array.from({ length: 50 }, () => a.next());
    const ys = Array.from({ length: 50 }, () => b.next());
    expect(xs).toEqual(ys);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('разные seed дают разные последовательности', () => {
    expect(createRng('a').next()).not.toBe(createRng('b').next());
  });

  it('потоки по меткам независимы: чтение одного не меняет другой', () => {
    const base = createRng('seed');
    const first = base.fork('age').next();
    base.fork('hair').next();
    base.fork('hair').next();
    expect(createRng('seed').fork('age').next()).toBe(first);
    expect(createRng('seed').fork('hair').next()).not.toBe(first);
  });

  it('weighted уважает веса и игнорирует нулевые', () => {
    const r = createRng('w');
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 4000; i++) counts[r.weighted(['a', 'b', 'c'] as const, (x) => ({ a: 1, b: 3, c: 0 })[x]) as 'a' | 'b' | 'c']++;
    expect(counts.c).toBe(0);
    expect(counts.b).toBeGreaterThan(counts.a * 2);
    expect(createRng('x').weighted([1, 2], () => 0)).toBeUndefined();
  });

  it('range включает границы, makeSeed даёт читаемый seed', () => {
    const r = createRng('range');
    const seen = new Set(Array.from({ length: 500 }, () => r.range(3, 5)));
    expect([...seen].sort()).toEqual([3, 4, 5]);
    expect(makeSeed()).toMatch(/^RP-[2-9A-HJ-NP-Z]{8}$/);
    expect(makeSeed()).not.toBe(makeSeed());
  });

  it('normalizeShares нормализует доли к сумме 1', () => {
    const n = normalizeShares({ a: 30, b: 10, c: 0 });
    expect(n.a + n.b + n.c).toBeCloseTo(1);
    expect(n.a).toBeCloseTo(0.75);
    const flat = normalizeShares({ a: 0, b: 0 });
    expect(flat.a).toBeCloseTo(0.5);
  });

  it('вес возраста: пик 25–33, остальные возрасты не исключены', () => {
    for (let a = AGE_MIN; a <= AGE_MAX; a++) expect(ageWeight(a)).toBeGreaterThan(0);
    expect(ageWeight(29)).toBeGreaterThan(ageWeight(22));
    expect(ageWeight(29)).toBeGreaterThan(ageWeight(42));
  });
});

describe('настройки: валидация и диапазоны', () => {
  it('значения по умолчанию корректны и устойчивы к нормализации', () => {
    const d = defaultSettings();
    const r = normalizeSettings(JSON.parse(JSON.stringify(d)));
    expect(r.problems).toEqual([]);
    expect(r.settings).toEqual(d);
    expect(d.age.min).toBe(20);
    expect(d.age.max).toBe(45);
    expect(d.sharpness).toBe('sharp');
    expect(d.allowSadEmotions).toBe(false);
    expect(d.style).toBe('smartphone');
  });

  it('мусор заменяется значениями по умолчанию', () => {
    for (const bad of [null, undefined, 5, 'x', [], { mode: 'bogus', age: 'x', choices: 7 }]) {
      const r = normalizeSettings(bad);
      expect(r.settings.mode).toBe('new');
      expect(r.settings.age.min).toBe(20);
    }
  });

  it('возраст ограничен 20–45, min/max меняются местами', () => {
    const r = normalizeSettings({ age: { min: 50, max: 5, exact: null } });
    expect(r.settings.age.min).toBeGreaterThanOrEqual(20);
    expect(r.settings.age.max).toBeLessThanOrEqual(45);
    expect(r.settings.age.min).toBeLessThanOrEqual(r.settings.age.max);
    const e = normalizeSettings({ age: { min: 20, max: 45, exact: 12 } });
    expect(e.settings.age.exact).toBe(20);
    expect(normalizeSettings({ age: { min: 20, max: 45, exact: 99 } }).settings.age.exact).toBe(45);
    expect(normalizeSettings({ age: { min: 20, max: 45, exact: 3.7 } }).problems.length).toBeGreaterThan(0);
  });

  it('числовые поля зажимаются в допустимые диапазоны', () => {
    const r = normalizeSettings({ spontaneity: 900, randomness: -5, batchCount: 1000, dupWindow: 9999, seriesLength: 0, historyLimit: 1 }).settings;
    expect(r.spontaneity).toBe(100);
    expect(r.randomness).toBe(0);
    expect(r.batchCount).toBe(100);
    expect(r.dupWindow).toBe(200);
    expect(r.seriesLength).toBe(2);
    expect(r.historyLimit).toBe(20);
  });

  it('значения полей выбора фильтруются по словарю; пустой выбор → авто', () => {
    const r = normalizeSettings({ choices: { season: { mode: 'manual', values: ['winter', 'bogus'] }, weather: { mode: 'manual', values: [] }, hairColor: { mode: 'exclude', values: ['x'] } } }).settings;
    expect(r.choices.season).toEqual({ mode: 'manual', values: ['winter'] });
    expect(r.choices.weather.mode).toBe('auto');
    expect(r.choices.hairColor.mode).toBe('auto');
  });

  it('доли типов съёмки: нулевая сумма восстанавливается, значения зажимаются', () => {
    const z = normalizeSettings({ captureShares: Object.fromEntries(CAPTURES.map((c) => [c, 0])) });
    expect(CAPTURES.some((c) => z.settings.captureShares[c] > 0)).toBe(true);
    expect(z.problems.length).toBeGreaterThan(0);
    const c = normalizeSettings({ captureShares: { 'selfie-arm': 500, candid: -3 } }).settings;
    expect(c.captureShares['selfie-arm']).toBe(100);
    expect(c.captureShares.candid).toBe(0);
  });

  it('формат кадра: пресеты, пользовательские пропорции и их границы', () => {
    for (const id of RATIO_IDS) {
      const r = ratioFromId(id);
      expect(r.label).toBe(id);
      expect(r.orientation).toBe(r.w > r.h ? 'horizontal' : r.w < r.h ? 'vertical' : 'square');
    }
    expect(describeRatio(1080, 1920).label).toBe('9:16');
    expect(describeRatio(10, 10).orientation).toBe('square');
    expect(isValidCustomRatio(7, 10)).toBe(true);
    expect(isValidCustomRatio(1, 5)).toBe(false);
    expect(isValidCustomRatio(5, 1)).toBe(false);
    expect(isValidCustomRatio(0, 4)).toBe(false);
    expect(isValidCustomRatio(2.5, 4)).toBe(false);
    expect(isValidCustomRatio(100, 100)).toBe(false);
    const s = defaultSettings();
    s.ratio = { mode: 'custom', preset: '9:16', custom: { w: 5, h: 7 } };
    expect(fixedRatio(s)?.label).toBe('5:7');
    expect(normalizeSettings({ ratio: { mode: 'custom', preset: '1:1', custom: { w: 1, h: 99 } } }).settings.ratio.mode).toBe('auto');
  });
});

describe('словарь безопасности', () => {
  it('отсекает намёки на несовместеннолетних, откровенные и брендовые слова', () => {
    for (const bad of ['a young girl', 'teenage woman', 'schoolgirl uniform', 'a child nearby', 'petite look', 'nude', 'lingerie', 'wearing Nike shoes', 'a company logo']) {
      expect(safetyProblems(bad).length).toBeGreaterThan(0);
    }
    expect(safetyProblems('a fictional adult woman, 31 years old, in a plain sweater')).toEqual([]);
  });
});
