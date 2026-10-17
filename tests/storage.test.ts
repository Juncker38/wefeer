import { describe, expect, it } from 'vitest';
import { MAX_USER_PRESETS, applyPreset, BUILTIN_PRESETS, createPreset, deletePreset, renamePreset } from '../src/core/presets.ts';
import { defaultSettings, normalizeSettings } from '../src/core/settings.ts';
import type { Character } from '../src/core/types.ts';
import { CONFIG_APP, CONFIG_SCHEMA, exportConfig, importConfig, normalizeCharacter } from '../src/storage/config.ts';
import { createMemoryRepo, filterHistory, trimHistory } from '../src/storage/history.ts';
import type { HistoryEntry } from '../src/storage/history.ts';
import { browserStore, loadJSON, memoryStore, removeKey, saveJSON } from '../src/storage/local.ts';
import type { KeyValueStore } from '../src/storage/local.ts';
import { renderScenario } from '../src/render/render.ts';
import { gen, seeds } from './helpers.ts';

function makeEntry(seed: string, n: number, favorite = false): HistoryEntry {
  const settings = defaultSettings();
  const scenario = gen(seed).scenario;
  const r = renderScenario(scenario, { profile: settings.profile, length: settings.length, includeNegative: true });
  return { id: `h-${seed}`, createdAt: 1_700_000_000_000 + n * 1000, favorite, scenario, settings, profile: settings.profile, length: settings.length, includeNegative: true, main: r.main, negative: r.negative };
}

describe('локальное хранилище настроек', () => {
  it('сохраняет и читает значения с версионным префиксом', () => {
    const store = memoryStore();
    expect(saveJSON(store, 'settings', { a: 1 })).toBe(true);
    expect(loadJSON(store, 'settings', null)).toEqual({ a: 1 });
    expect(store.getItem('realphoto:v1:settings')).toBe('{"a":1}');
    removeKey(store, 'settings');
    expect(loadJSON(store, 'settings', 'пусто')).toBe('пусто');
  });

  it('повреждённые данные, недоступное и переполненное хранилище не ломают приложение', () => {
    const store = memoryStore();
    store.setItem('realphoto:v1:bad', '{не json');
    expect(loadJSON(store, 'bad', 7)).toBe(7);
    expect(loadJSON(null, 'x', 'fallback')).toBe('fallback');
    expect(saveJSON(null, 'x', 1)).toBe(false);
    const full: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(saveJSON(full, 'x', 1)).toBe(false);
    expect(() => removeKey(full, 'x')).not.toThrow();
    expect(() => browserStore()).not.toThrow();
  });

  it('настройки переживают сохранение и загрузку без потерь', () => {
    const store = memoryStore();
    const s = defaultSettings();
    s.mode = 'series';
    s.age = { min: 25, max: 33, exact: null };
    s.choices.season = { mode: 'manual', values: ['autumn'] };
    s.captureShares['selfie-arm'] = 0;
    s.locks = ['season', 'hair'];
    saveJSON(store, 'settings', s);
    const back = normalizeSettings(loadJSON<unknown>(store, 'settings', null));
    expect(back.problems).toEqual([]);
    expect(back.settings).toEqual(s);
  });
});

describe('история: хранение, поиск, фильтры, лимит', () => {
  const entries = seeds(12, 'HIST').map((seed, i) => makeEntry(seed, i, i === 3));

  it('репозиторий в памяти: добавление, порядок «новые первыми», удаление, очистка и изоляция копий', async () => {
    const repo = createMemoryRepo();
    expect(repo.persistent).toBe(false);
    await repo.put(entries[0] as HistoryEntry);
    await repo.putMany(entries.slice(1, 5));
    const list = await repo.list();
    expect(list.map((e) => e.id)).toEqual(entries.slice(0, 5).map((e) => e.id).reverse());
    (list[0] as HistoryEntry).main = 'изменено снаружи';
    expect(((await repo.list())[0] as HistoryEntry).main).not.toBe('изменено снаружи');
    await repo.remove((entries[2] as HistoryEntry).id);
    expect(await repo.list()).toHaveLength(4);
    await repo.clear();
    expect(await repo.list()).toEqual([]);
  });

  it('поиск по нескольким словам, регистр не важен; фильтры сочетаются', () => {
    const target = entries[5] as HistoryEntry;
    const byId = filterHistory(entries, { query: target.scenario.seed.toUpperCase() });
    expect(byId.map((e) => e.id)).toContain(target.id);
    expect(filterHistory(entries, { query: 'zzzz-нет-такого' })).toEqual([]);
    expect(filterHistory(entries, { query: `${target.scenario.seed} ${target.scenario.sceneTitle}` }).map((e) => e.id)).toContain(target.id);
    expect(filterHistory(entries, { favoritesOnly: true }).map((e) => e.id)).toEqual([(entries[3] as HistoryEntry).id]);
    const season = target.scenario.season;
    expect(filterHistory(entries, { season }).every((e) => e.scenario.season === season)).toBe(true);
    const category = target.scenario.category;
    expect(filterHistory(entries, { category, season }).every((e) => e.scenario.category === category && e.scenario.season === season)).toBe(true);
    expect(filterHistory(entries, { mode: 'all', category: 'all', season: 'all', capture: 'all' })).toHaveLength(entries.length);
    expect(filterHistory(entries, { capture: target.scenario.capture }).every((e) => e.scenario.capture === target.scenario.capture)).toBe(true);
  });

  it('лимит истории: сначала удаляются самые старые, избранное сохраняется', () => {
    const { kept, removed } = trimHistory(entries, 8);
    expect(kept).toHaveLength(8);
    expect(removed).toHaveLength(4);
    expect(kept.some((e) => e.favorite)).toBe(true);
    expect(removed.every((e) => !e.favorite)).toBe(true);
    const oldest = entries.filter((e) => !e.favorite).sort((a, b) => a.createdAt - b.createdAt).slice(0, 4);
    expect(removed.map((e) => e.id).sort()).toEqual(oldest.map((e) => e.id).sort());
    const allFav = entries.map((e) => ({ ...e, favorite: true }));
    expect(trimHistory(allFav, 5).removed).toEqual([]);
    expect(trimHistory(entries, 100).removed).toEqual([]);
  });
});

describe('пресеты', () => {
  it('создание сбрасывает seed и закрепления; применение сохраняет текущие seed, закрепления и лимит истории', () => {
    const s = defaultSettings();
    s.seed = 'MY-SEED';
    s.locks = ['season'];
    s.historyLimit = 777;
    s.spontaneity = 91;
    const p = createPreset('  Мой   пресет  ', s, 'user-test-1');
    expect(p.name).toBe('Мой пресет');
    expect(p.settings.seed).toBe('');
    expect(p.settings.locks).toEqual([]);
    expect(p.settings.spontaneity).toBe(91);
    const current = defaultSettings();
    current.seed = 'KEEP';
    current.locks = ['hair'];
    current.historyLimit = 300;
    const applied = applyPreset(current, p);
    expect(applied.spontaneity).toBe(91);
    expect(applied.seed).toBe('KEEP');
    expect(applied.locks).toEqual(['hair']);
    expect(applied.historyLimit).toBe(300);
    expect(createPreset('   ', s).name).toBe('Без названия');
    expect(MAX_USER_PRESETS).toBeGreaterThan(5);
  });

  it('встроенные пресеты нельзя удалить или переименовать; пользовательские — можно', () => {
    const user = createPreset('Свой', defaultSettings(), 'user-test-2');
    const all = [...BUILTIN_PRESETS, user];
    expect(deletePreset(all, BUILTIN_PRESETS[0]!.id)).toHaveLength(all.length);
    expect(deletePreset(all, 'user-test-2')).toHaveLength(all.length - 1);
    expect(renamePreset(all, BUILTIN_PRESETS[0]!.id, 'Взлом').find((p) => p.id === BUILTIN_PRESETS[0]!.id)?.name).toBe(BUILTIN_PRESETS[0]!.name);
    expect(renamePreset(all, 'user-test-2', ' Новое имя ').find((p) => p.id === 'user-test-2')?.name).toBe('Новое имя');
    expect(renamePreset(all, 'user-test-2', '   ').find((p) => p.id === 'user-test-2')?.name).toBe('Свой');
  });
});

describe('импорт и экспорт конфигурации', () => {
  const character: Character = (() => {
    const sc = gen('CHAR-CFG').scenario;
    return { id: 'char-1234', name: 'Анна', subject: sc.subject, createdAt: 1_700_000_000_000 };
  })();

  it('круговой обмен: настройки, пользовательские пресеты и персонаж сохраняются; встроенные пресеты не выгружаются', () => {
    const s = defaultSettings();
    s.mode = 'character';
    s.age = { min: 30, max: 40, exact: null };
    s.choices.category = { mode: 'manual', values: ['home', 'food'] };
    const user = createPreset('Мой', s, 'user-abc-1');
    const text = exportConfig({ settings: s, presets: [...BUILTIN_PRESETS, user], character }, Date.UTC(2026, 0, 1));
    const raw = JSON.parse(text);
    expect(raw.app).toBe(CONFIG_APP);
    expect(raw.schema).toBe(CONFIG_SCHEMA);
    expect(raw.presets).toHaveLength(1);
    const res = importConfig(text);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.warnings).toEqual([]);
    expect(res.bundle.settings).toEqual(s);
    expect(res.bundle.presets).toHaveLength(1);
    expect(res.bundle.presets[0]?.name).toBe('Мой');
    expect(res.bundle.character).toEqual(character);
  });

  it('отклоняет чужие, повреждённые и неподдерживаемые файлы с понятным сообщением', () => {
    for (const bad of ['{не json', '[]', '42', JSON.stringify({ app: 'Другое приложение', schema: 1 }), JSON.stringify({ app: CONFIG_APP, schema: 99 })]) {
      const res = importConfig(bad);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.length).toBeGreaterThan(10);
    }
  });

  it('недопустимые значения исправляются с предупреждением; возраст всегда в пределах 20–45', () => {
    const res = importConfig(
      JSON.stringify({
        app: CONFIG_APP,
        schema: CONFIG_SCHEMA,
        settings: { mode: 'неизвестно', age: { min: 5, max: 90, exact: 17 }, batchCount: 5000, ratio: { mode: 'custom', preset: '9:16', custom: { w: 1, h: 90 } } },
        presets: [{ id: 'user-ok-1', name: 'Ок', settings: { age: { min: 18, max: 60, exact: null } } }, { id: '!', name: 'Плохой', settings: {} }, 'мусор'],
        character: { id: 'char-1', name: 'X', subject: { age: 17 } },
      }),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const { settings, presets, character: ch } = res.bundle;
    expect(settings.mode).toBe('new');
    expect(settings.age.min).toBeGreaterThanOrEqual(20);
    expect(settings.age.max).toBeLessThanOrEqual(45);
    expect(settings.age.exact === null || (settings.age.exact >= 20 && settings.age.exact <= 45)).toBe(true);
    expect(settings.batchCount).toBe(100);
    expect(settings.ratio.mode).not.toBe('custom');
    expect(presets).toHaveLength(1);
    expect(presets[0]?.settings.age.min).toBe(20);
    expect(presets[0]?.settings.age.max).toBe(45);
    expect(ch).toBeNull();
    expect(res.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('паспорт персонажа проверяется: возраст, словари, идентификатор', () => {
    expect(normalizeCharacter(character)).toEqual(character);
    expect(normalizeCharacter({ ...character, subject: { ...character.subject, age: 19 } })).toBeNull();
    expect(normalizeCharacter({ ...character, subject: { ...character.subject, age: 46 } })).toBeNull();
    expect(normalizeCharacter({ ...character, subject: { ...character.subject, hairColor: 'neon' } })).toBeNull();
    expect(normalizeCharacter({ ...character, id: 'a' })).toBeNull();
    expect(normalizeCharacter({ ...character, name: '   ' })?.name).toBe('Персонаж');
    expect(normalizeCharacter(null)).toBeNull();
  });
});
