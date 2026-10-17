import { describe, expect, it } from 'vitest';
import { PROFILE_HELP } from '../src/core/labels.ts';
import { BUILTIN_PRESETS } from '../src/core/presets.ts';
import { defaultSettings } from '../src/core/settings.ts';
import type { Settings } from '../src/core/settings.ts';
import type { PhotoScenario } from '../src/core/types.ts';
import { LENGTHS, PROFILES } from '../src/core/vocab.ts';
import { generateScenario } from '../src/engine/generate.ts';
import { validateScenario } from '../src/engine/validate.ts';
import { CSV_COLUMNS, batchFilename, csvCell, entriesToCsv, entriesToJson, entriesToTxt, entryToJson, entryToTxt, safeFilename, singleFilename } from '../src/export/files.ts';
import { renderScenario } from '../src/render/render.ts';
import type { HistoryEntry } from '../src/storage/history.ts';
import { gen, seeds, settingsWith } from './helpers.ts';

function entryFor(scenario: PhotoScenario, settings: Settings, n = 0): HistoryEntry {
  const r = renderScenario(scenario, { profile: settings.profile, length: settings.length, includeNegative: settings.includeNegative });
  return { id: `e-${n}`, createdAt: Date.UTC(2026, 0, 2, 3, 4, 5) + n * 1000, favorite: n % 2 === 0, scenario, settings, profile: settings.profile, length: settings.length, includeNegative: settings.includeNegative, main: r.main, negative: r.negative };
}

/** Разбор CSV по RFC 4180: поля в кавычках, удвоенные кавычки, переводы строк внутри поля. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i] as string;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' && src[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i++;
    } else cell += ch;
  }
  return rows;
}

describe('рендерер: форматы и профили', () => {
  it('английский текст без кириллицы, с явным возрастом 20–45 и без запрещённой лексики — для всех профилей и длин', () => {
    for (const seed of seeds(40, 'REND')) {
      const sc = gen(seed).scenario;
      for (const profile of PROFILES) {
        for (const length of LENGTHS) {
          const r = renderScenario(sc, { profile, length, includeNegative: true });
          expect(r.problems, `${seed} ${profile} ${length}`).toEqual([]);
          expect(r.main).not.toMatch(/[а-яё]/i);
          const age = /(\d{2}) years old/.exec(r.main);
          expect(age, `${seed} ${profile} ${length}: возраст`).not.toBeNull();
          expect(Number(age?.[1])).toBeGreaterThanOrEqual(20);
          expect(Number(age?.[1])).toBeLessThanOrEqual(45);
          expect(r.main).toMatch(/fictional adult woman/);
        }
      }
    }
  });

  it('длина влияет на объём: короткий < стандартный < подробный', () => {
    const avg = (length: (typeof LENGTHS)[number]) => {
      const words = seeds(40, 'LEN').map((s) => renderScenario(gen(s).scenario, { profile: 'universal', length, includeNegative: true }).words);
      return words.reduce((a, b) => a + b, 0) / words.length;
    };
    const [short, standard, detailed] = [avg('short'), avg('standard'), avg('detailed')];
    expect(short).toBeLessThan(standard);
    expect(standard).toBeLessThan(detailed);
  });

  it('профили — только форматирование текста; negative учитывается в соответствии с профилем', () => {
    const sc = gen('PROFILE-1').scenario;
    const universal = renderScenario(sc, { profile: 'universal', length: 'standard', includeNegative: true });
    expect(universal.main).not.toMatch(/Avoid:|Do not include:|avoid:/);
    expect(universal.negative.length).toBeGreaterThan(40);
    const gpt = renderScenario(sc, { profile: 'gpt-image', length: 'standard', includeNegative: true });
    expect(gpt.main).toContain(`Avoid: ${universal.negative}.`);
    const nano = renderScenario(sc, { profile: 'nano-banana', length: 'standard', includeNegative: true });
    expect(nano.main.startsWith('Create a photorealistic image.')).toBe(true);
    expect(nano.main).toContain(`Do not include: ${universal.negative}.`);
    const seed = renderScenario(sc, { profile: 'seedance', length: 'standard', includeNegative: true });
    expect(seed.main.startsWith('Single still frame, no camera movement:')).toBe(true);
    expect(seed.main).not.toContain('\n');
    const without = renderScenario(sc, { profile: 'gpt-image', length: 'standard', includeNegative: false });
    expect(without.main).not.toContain('Avoid:');
    expect(JSON.parse(without.json).prompt.negative).toBeNull();
    for (const p of PROFILES) expect(PROFILE_HELP[p]).not.toMatch(/гарантирован(?!о)|100\s?%|официальн/i);
  });

  it('рендер детерминирован и JSON содержит сценарий целиком', () => {
    const sc = gen('RJSON-1').scenario;
    const opts = { profile: 'universal', length: 'standard', includeNegative: true } as const;
    const a = renderScenario(sc, opts);
    const b = renderScenario(sc, opts);
    expect(a).toEqual(b);
    const json = JSON.parse(a.json);
    expect(json.app).toBe('RealPhoto Prompt Studio');
    expect(json.prompt.main).toBe(a.main);
    expect(json.scenario.seed).toBe(sc.seed);
    expect(json.scenario.subject.age).toBe(sc.subject.age);
    expect(a.metadata.find((m) => m.key === 'Seed')?.value).toBe(sc.seed);
    expect(a.metadata.find((m) => m.key === 'Профиль экспорта')?.value).toMatch(/только форматирование текста/);
  });

  it('формат кадра попадает в текст и метаданные', () => {
    for (const ratio of ['9:16', '16:9', '1:1', '21:9'] as const) {
      const sc = gen(`RATIO-TXT-${ratio}`, (s) => (s.ratio = { mode: 'preset', preset: ratio, custom: s.ratio.custom })).scenario;
      const r = renderScenario(sc, { profile: 'universal', length: 'standard', includeNegative: true });
      expect(r.main).toContain(ratio);
      expect(r.metadata.find((m) => m.key === 'Aspect ratio')?.value).toContain(ratio);
    }
  });
});

describe('экспорт: TXT, JSON, CSV и имена файлов', () => {
  const settings = defaultSettings();
  const entries = seeds(6, 'EXP').map((seed, i) => entryFor(gen(seed).scenario, settings, i));

  it('TXT: промпт, negative, seed и пометка про форматирование', () => {
    const e = entries[0] as HistoryEntry;
    const txt = entryToTxt(e);
    expect(txt).toContain(e.main.trim());
    expect(txt).toContain(`Negative prompt: ${e.negative}`);
    expect(txt).toContain(`Seed: ${e.scenario.seed}`);
    expect(txt).toContain('(text formatting only)');
    expect(entryToTxt(e, false)).not.toContain('Negative prompt:');
    const inline = entryFor(e.scenario, settingsWith((s) => (s.profile = 'gpt-image')));
    expect(entryToTxt(inline, true)).not.toContain('Negative prompt:');
    expect(entriesToTxt(entries).split('\n---\n\n')).toHaveLength(entries.length);
    expect(entriesToTxt(entries)).toContain(`#${entries.length}`);
  });

  it('JSON: одиночный и пакетный экспорт разбираются и содержат параметры', () => {
    const one = JSON.parse(entryToJson(entries[1] as HistoryEntry));
    expect(one.seed).toBe((entries[1] as HistoryEntry).scenario.seed);
    expect(one.mainPrompt).toBe((entries[1] as HistoryEntry).main);
    expect(one.settings.version).toBe(1);
    const all = JSON.parse(entriesToJson(entries));
    expect(all.count).toBe(entries.length);
    expect(all.items.map((i: { scenarioId: string }) => i.scenarioId)).toEqual(entries.map((e) => e.scenario.id));
    for (const item of all.items) {
      expect(item.scenario.subject.age).toBeGreaterThanOrEqual(20);
      expect(item.scenario.subject.age).toBeLessThanOrEqual(45);
    }
  });

  it('CSV: BOM, CRLF, заголовок и построчное соответствие данным; многострочные поля сохраняются', () => {
    const csv = entriesToCsv(entries);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    const rows = parseCsv(csv);
    expect(rows[0]).toEqual([...CSV_COLUMNS]);
    expect(rows).toHaveLength(entries.length + 1);
    const col = (name: (typeof CSV_COLUMNS)[number]) => CSV_COLUMNS.indexOf(name);
    entries.forEach((e, i) => {
      const row = rows[i + 1] as string[];
      expect(row).toHaveLength(CSV_COLUMNS.length);
      expect(row[col('main_prompt')]).toBe(e.main);
      expect(row[col('negative_prompt')]).toBe(e.negative);
      expect(row[col('seed')]).toBe(e.scenario.seed);
      expect(Number(row[col('age')])).toBe(e.scenario.subject.age);
    });
    const gpt = entryFor((entries[0] as HistoryEntry).scenario, settingsWith((s) => (s.profile = 'gpt-image')));
    expect(gpt.main).toContain('\n');
    expect((parseCsv(entriesToCsv([gpt]))[1] as string[])[col('main_prompt')]).toBe(gpt.main);
  });

  it('CSV: кавычки, запятые и защита от формул', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('строка\nвторая')).toBe('"строка\nвторая"');
    expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('-5')).toBe("'-5");
    expect(csvCell(42)).toBe('42');
    expect(csvCell(true)).toBe('true');
  });

  it('имена файлов безопасны и предсказуемы', () => {
    expect(safeFilename('../../etc/passwd', 'txt')).toBe('etc-passwd.txt');
    expect(safeFilename('Привет мир', 'JSON')).toBe('realphoto.json');
    expect(safeFilename('a b  c', 'x!y')).toBe('a-b-c.xy');
    expect(safeFilename('x'.repeat(200), 'txt').length).toBeLessThanOrEqual(84);
    const e = entries[0] as HistoryEntry;
    expect(singleFilename(e, 'txt', new Date(2026, 0, 2, 3, 4, 5))).toMatch(/^realphoto-universal-20260102-030405-EXP-0\.txt$/);
    expect(batchFilename(5, 'csv', new Date(2026, 0, 2, 3, 4, 5))).toBe('realphoto-batch-5-20260102-030405.csv');
    for (const f of [singleFilename(e, 'json'), batchFilename(100, 'txt')]) expect(f).toMatch(/^[A-Za-z0-9._-]+$/);
  });
});

describe('встроенные пресеты', () => {
  it('каждый пресет корректен и даёт согласованные кадры', () => {
    expect(BUILTIN_PRESETS.length).toBeGreaterThanOrEqual(5);
    for (const preset of BUILTIN_PRESETS) {
      for (const seed of seeds(15, `PRESET-${preset.id}`)) {
        const out = generateScenario({ settings: preset.settings, seed });
        expect(out.ok, `${preset.id} ${seed}`).toBe(true);
        if (out.ok) expect(validateScenario(out.result.scenario)).toEqual([]);
      }
    }
  });
});
