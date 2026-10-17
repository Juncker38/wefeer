import { describe, expect, it } from 'vitest';
import { safetyProblems } from '../src/core/safety.ts';
import { OUTFIT_TAGS, SCENE_TAGS, SEASONS, STYLES, TIMES, WEATHERS } from '../src/core/vocab.ts';
import type { OutfitTag } from '../src/core/vocab.ts';
import { GENERIC_DETAILS, IMPERFECTIONS } from '../src/data/details.ts';
import { OUTFIT_COLORS, OUTFITS } from '../src/data/outfits.ts';
import { formatProblems, neutralityProblems } from '../src/data/validate.ts';

const CYR = /[А-Яа-яЁё]/;
const COVERAGE: Record<OutfitTag, { needs: number[]; min: number }> = {
  casual: { needs: [0, 1, 2, 3, 4], min: 6 },
  cozy: { needs: [0, 1, 2, 3, 4], min: 3 },
  smart: { needs: [0, 1, 2, 3, 4], min: 4 },
  evening: { needs: [0, 1, 2, 3, 4], min: 3 },
  sport: { needs: [0, 1, 2, 3, 4], min: 4 },
  dance: { needs: [0, 1, 2, 3], min: 3 },
  swim: { needs: [0, 1], min: 5 },
  beach: { needs: [0, 1, 2, 3], min: 4 },
  ski: { needs: [3, 4], min: 4 },
  hiking: { needs: [0, 1, 2, 3, 4], min: 4 },
  work: { needs: [0, 1, 2, 3, 4], min: 3 },
  travel: { needs: [0, 1, 2, 3, 4], min: 4 },
};

describe('библиотека одежды', () => {
  it('достаточно объёмна, палитра задана', () => {
    expect(OUTFITS.length).toBeGreaterThanOrEqual(130);
    expect(OUTFIT_COLORS.length).toBeGreaterThanOrEqual(16);
    for (const c of OUTFIT_COLORS) expect(formatProblems('color', c, 3, 24)).toEqual([]);
  });

  it('id уникальны, поля корректны', () => {
    const ids = new Set<string>();
    const problems: string[] = [];
    for (const o of OUTFITS) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(o.id)) problems.push(`${o.id}: id kebab-case`);
      if (ids.has(o.id)) problems.push(`${o.id}: повтор id`);
      ids.add(o.id);
      problems.push(...formatProblems(`${o.id}.en`, o.en, 12, 170));
      if ((o.en.match(/\{c\}/g) ?? []).length > 2) problems.push(`${o.id}: не более двух {c}`);
      if (!CYR.test(o.ru) || o.ru.length < 6 || o.ru.length > 110) problems.push(`${o.id}.ru: русская фраза 6–110 символов`);
      if (!(o.w[0] >= 0 && o.w[1] <= 4 && o.w[0] <= o.w[1] && Number.isInteger(o.w[0]) && Number.isInteger(o.w[1]))) problems.push(`${o.id}: w = [мин, макс] в 0..4`);
      if (!o.tags.length || o.tags.some((t) => !(OUTFIT_TAGS as readonly string[]).includes(t))) problems.push(`${o.id}: теги`);
    }
    expect(problems).toEqual([]);
  });

  it('покрывает все семейства одежды и диапазоны тепла', () => {
    const problems: string[] = [];
    for (const tag of OUTFIT_TAGS) {
      const { needs, min } = COVERAGE[tag];
      for (const n of needs) {
        const c = OUTFITS.filter((o) => o.tags.includes(tag) && o.w[0] <= n && n <= o.w[1]).length;
        if (c < min) problems.push(`тег ${tag}, потребность ${n}: ${c} < ${min}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('есть непромокаемая одежда, капюшоны и ограничения по дождю/снегу', () => {
    const rainwear = OUTFITS.filter((o) => o.rainwear);
    expect(rainwear.length).toBeGreaterThanOrEqual(14);
    for (const n of [1, 2, 3, 4]) expect(rainwear.filter((o) => o.w[0] <= n && n <= o.w[1]).length).toBeGreaterThanOrEqual(3);
    for (const t of ['casual', 'hiking', 'travel', 'smart'] as const) expect(rainwear.filter((o) => o.tags.includes(t)).length).toBeGreaterThanOrEqual(2);
    expect(OUTFITS.filter((o) => o.hood).length).toBeGreaterThanOrEqual(10);
    expect(OUTFITS.filter((o) => o.rain === 'no').length).toBeGreaterThanOrEqual(8);
    expect(OUTFITS.filter((o) => o.snow === 'no').length).toBeGreaterThanOrEqual(8);
    expect(OUTFITS.filter((o) => o.snow === 'no' && o.w[1] >= 3).length).toBeLessThanOrEqual(4);
  });
});

describe('общие детали и фотонесовершенства', () => {
  it('детали корректны и нейтральны к погоде/сезону/времени', () => {
    expect(GENERIC_DETAILS.length).toBeGreaterThanOrEqual(70);
    const problems: string[] = [];
    GENERIC_DETAILS.forEach((d, i) => {
      const lab = `detail[${i}]`;
      problems.push(...formatProblems(lab, d.en, 10, 120));
      for (const t of d.tags ?? []) if (!(SCENE_TAGS as readonly string[]).includes(t)) problems.push(`${lab}: тег ${t}`);
      const axes = { se: d.seasons ?? SEASONS, we: d.weathers ?? WEATHERS, ti: d.times ?? TIMES };
      problems.push(...neutralityProblems(lab, d.en, axes, d.tags ?? []));
    });
    expect(problems).toEqual([]);
  });

  it('покрытие условий', () => {
    const problems: string[] = [];
    const cnt = (f: (d: (typeof GENERIC_DETAILS)[number]) => boolean) => GENERIC_DETAILS.filter(f).length;
    for (const w of WEATHERS) {
      const min = ['overcast', 'partly-cloudy'].includes(w) ? 2 : 3;
      if (cnt((d) => !!d.weathers?.includes(w)) < min) problems.push(`погода ${w}: меньше ${min} деталей`);
    }
    for (const s of SEASONS) if (cnt((d) => !!d.seasons?.includes(s)) < 5) problems.push(`сезон ${s}: меньше 5 деталей`);
    for (const t of TIMES) if (cnt((d) => !!d.times?.includes(t)) < 4) problems.push(`время ${t}: меньше 4 деталей`);
    for (const t of SCENE_TAGS) if (cnt((d) => !!d.tags?.includes(t)) < 2) problems.push(`тег ${t}: меньше 2 деталей`);
    if (cnt((d) => !d.seasons && !d.weathers && !d.times) < 20) problems.push('безусловных деталей меньше 20');
    if (cnt((d) => !!d.env?.includes('indoor')) < 10) problems.push('деталей для помещений меньше 10');
    expect(problems).toEqual([]);
  });

  it('фотонесовершенства корректны', () => {
    expect(IMPERFECTIONS.length).toBeGreaterThanOrEqual(24);
    const problems: string[] = [];
    IMPERFECTIONS.forEach((d, i) => {
      const lab = `imperfection[${i}]`;
      problems.push(...formatProblems(lab, d.en, 10, 120));
      problems.push(...safetyProblems(d.en));
      const axes = { se: SEASONS, we: WEATHERS, ti: d.times ?? TIMES };
      problems.push(...neutralityProblems(lab, d.en, axes, []));
    });
    for (const s of STYLES) {
      const min = s === 'smartphone' ? 10 : 4;
      const c = IMPERFECTIONS.filter((d) => !d.styles || d.styles.includes(s)).length;
      if (c < min) problems.push(`стиль ${s}: меньше ${min} несовершенств`);
    }
    if (IMPERFECTIONS.filter((d) => d.times?.some((t) => t === 'dusk' || t === 'evening' || t === 'night')).length < 4) problems.push('вечерних/ночных несовершенств меньше 4');
    expect(problems).toEqual([]);
  });
});
