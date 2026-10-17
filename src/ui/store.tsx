import { createContext, useCallback, useContext, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { BUILTIN_PRESETS, MAX_USER_PRESETS, applyPreset, cleanName, createPreset, deletePreset, renamePreset } from '../core/presets.ts';
import type { Preset } from '../core/presets.ts';
import { randomizeSettings } from '../core/randomize.ts';
import { defaultSettings, normalizeSettings } from '../core/settings.ts';
import type { Settings } from '../core/settings.ts';
import type { Character, HistoryFeature, PhotoScenario } from '../core/types.ts';
import type { LockKey } from '../core/vocab.ts';
import { runBatch } from '../engine/batch.ts';
import { explainConstraints } from '../engine/diversity.ts';
import { countFeasibleScenes } from '../engine/diversity.ts';
import { editScenario, generateScenario, rerollAspect } from '../engine/generate.ts';
import type { DiversityReport, RerollAspect, ScenarioPatch } from '../engine/generate.ts';
import { makeSeed } from '../engine/rng.ts';
import { generateSeries } from '../engine/series.ts';
import { featuresOf } from '../engine/similarity.ts';
import { copyText, downloadText } from '../export/browser.ts';
import { batchFilename, entriesToCsv, entriesToJson, entriesToTxt, entryToJson, entryToTxt, safeFilename, singleFilename } from '../export/files.ts';
import { renderScenario } from '../render/render.ts';
import type { Rendered } from '../render/render.ts';
import { exportConfig, importConfig, normalizeCharacter } from '../storage/config.ts';
import { createRepo, trimHistory } from '../storage/history.ts';
import type { HistoryEntry, HistoryRepo } from '../storage/history.ts';
import { browserStore, loadJSON, saveJSON } from '../storage/local.ts';

export type View = 'studio' | 'batch' | 'history' | 'presets' | 'about';
export type ThemePref = 'system' | 'light' | 'dark';
export type SettingsTab = 'quick' | 'advanced';

export interface ToastItem {
  id: number;
  kind: 'info' | 'success' | 'error';
  text: string;
}

export interface Current {
  scenario: PhotoScenario;
  entryId: string | null;
  diversity: DiversityReport | null;
  settings: Settings;
}

export interface SeriesState {
  title: string;
  frames: { scenario: PhotoScenario; entryId: string }[];
  index: number;
}

export interface BatchState {
  running: boolean;
  done: number;
  total: number;
  items: HistoryEntry[];
  cancelled: boolean;
  title: string | null;
  failures: number;
  tooStrict: number;
  finished: boolean;
}

export interface GenerateError {
  reason: string;
  hints: string[];
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export type CopyKind = 'main' | 'main+negative' | 'negative' | 'json' | 'ru';

export interface StudioApi {
  settings: Settings;
  setSettings: (fn: (s: Settings) => Settings) => void;
  settingsTab: SettingsTab;
  setSettingsTab: (t: SettingsTab) => void;
  view: View;
  setView: (v: View) => void;
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  current: Current | null;
  rendered: Rendered | null;
  series: SeriesState | null;
  selectSeriesFrame: (i: number) => void;
  error: GenerateError | null;
  feasible: number;
  report: () => ReturnType<typeof explainConstraints>;
  presets: Preset[];
  builtinPresets: readonly Preset[];
  character: Character | null;
  history: HistoryEntry[];
  historyReady: boolean;
  historyPersistent: boolean;
  storageWarning: boolean;
  batch: BatchState;
  toasts: ToastItem[];
  dismissToast: (id: number) => void;
  confirmState: (ConfirmOptions & { resolve: (v: boolean) => void }) | null;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  // действия
  generate: () => void;
  generateMore: () => void;
  repeat: () => void;
  randomizeAll: () => void;
  resetSettings: () => Promise<void>;
  toggleFavoriteCurrent: () => void;
  copy: (kind: CopyKind) => Promise<void>;
  download: (kind: 'txt' | 'json') => void;
  reroll: (aspect: RerollAspect) => void;
  edit: (patch: ScenarioPatch) => { ok: true } | { ok: false; reason: string };
  toggleLock: (key: LockKey) => void;
  pinSeed: () => void;
  // персонаж
  makeCharacter: () => void;
  renameCharacter: (name: string) => void;
  clearCharacter: () => Promise<void>;
  exportCharacter: (kind: 'txt' | 'json') => void;
  // пресеты и конфигурация
  applyPresetById: (id: string) => void;
  savePreset: (name: string) => boolean;
  renamePresetById: (id: string, name: string) => void;
  deletePresetById: (id: string) => Promise<void>;
  downloadConfig: () => void;
  importConfigText: (text: string) => { ok: boolean; message: string };
  // история
  openEntry: (id: string) => void;
  toggleFavorite: (id: string) => void;
  removeEntry: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  exportEntries: (entries: HistoryEntry[], kind: 'csv' | 'json' | 'txt', label?: string) => void;
  copyEntry: (e: HistoryEntry, withNegative: boolean) => Promise<void>;
  downloadEntry: (e: HistoryEntry, kind: 'txt' | 'json') => void;
  // пакет
  startBatch: (count: number, addToHistory: boolean) => Promise<void>;
  cancelBatch: () => void;
  toast: (text: string, kind?: ToastItem['kind']) => void;
}

const Ctx = createContext<StudioApi | null>(null);

export function useStudio(): StudioApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStudio вне StudioProvider');
  return v;
}

let counter = 0;
const newEntryId = (offset = 0): string => `${(Date.now() + offset).toString(36)}-${(counter++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

function loadUserPresets(ls: ReturnType<typeof browserStore>): Preset[] {
  const raw = loadJSON<unknown>(ls, 'presets', []);
  if (!Array.isArray(raw)) return [];
  const out: Preset[] = [];
  for (const p of raw.slice(0, MAX_USER_PRESETS)) {
    if (typeof p !== 'object' || p === null) continue;
    const r = p as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.name !== 'string') continue;
    out.push({ id: r.id, name: cleanName(r.name) || 'Без названия', settings: normalizeSettings(r.settings).settings });
  }
  return out;
}

function makeEntry(scenario: PhotoScenario, snapshot: Settings, offset = 0): HistoryEntry {
  const r = renderScenario(scenario, { profile: snapshot.profile, length: snapshot.length, includeNegative: snapshot.includeNegative });
  return {
    id: newEntryId(offset),
    createdAt: Date.now() + offset,
    favorite: false,
    scenario,
    settings: snapshot,
    profile: snapshot.profile,
    length: snapshot.length,
    includeNegative: snapshot.includeNegative,
    main: r.main,
    negative: r.negative,
  };
}

const EMPTY_BATCH: BatchState = { running: false, done: 0, total: 0, items: [], cancelled: false, title: null, failures: 0, tooStrict: 0, finished: false };

export function StudioProvider({ children }: { children: ReactNode }) {
  const ls = useMemo(() => browserStore(), []);
  const [settings, setSettingsState] = useState<Settings>(() => normalizeSettings(loadJSON<unknown>(ls, 'settings', null)).settings);
  const [presets, setPresets] = useState<Preset[]>(() => loadUserPresets(ls));
  const [character, setCharacterState] = useState<Character | null>(() => normalizeCharacter(loadJSON<unknown>(ls, 'character', null)));
  const [theme, setThemeState] = useState<ThemePref>(() => {
    const v = loadJSON<string>(ls, 'theme', 'system');
    return v === 'light' || v === 'dark' ? v : 'system';
  });
  const [view, setView] = useState<View>('studio');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('quick');
  const [current, setCurrent] = useState<Current | null>(null);
  const [series, setSeries] = useState<SeriesState | null>(null);
  const [error, setError] = useState<GenerateError | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [historyPersistent, setHistoryPersistent] = useState(true);
  const [storageWarning, setStorageWarning] = useState(false);
  const [batch, setBatch] = useState<BatchState>(EMPTY_BATCH);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<StudioApi['confirmState']>(null);

  const repoRef = useRef<HistoryRepo | null>(null);
  const historyRef = useRef<HistoryEntry[]>([]);
  const currentRef = useRef<Current | null>(null);
  const settingsRef = useRef(settings);
  const characterRef = useRef(character);
  const abortRef = useRef<AbortController | null>(null);
  const toastId = useRef(0);
  const rerollCounter = useRef(0);
  settingsRef.current = settings;
  currentRef.current = current;
  characterRef.current = character;
  historyRef.current = history;

  // ───────── уведомления и подтверждения ─────────
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((text: string, kind: ToastItem['kind'] = 'info') => {
    const id = (toastId.current += 1);
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3800);
  }, []);
  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) =>
        setConfirmState({
          ...o,
          resolve: (v) => {
            setConfirmState(null);
            resolve(v);
          },
        }),
      ),
    [],
  );

  // ───────── хранилище ─────────
  useEffect(() => {
    let alive = true;
    createRepo()
      .then(async (repo) => {
        repoRef.current = repo;
        setHistoryPersistent(repo.persistent);
        const list = await repo.list();
        if (alive) setHistory(list);
      })
      .catch(() => setHistoryPersistent(false))
      .finally(() => alive && setHistoryReady(true));
    return () => {
      alive = false;
    };
  }, []);

  const persistRef = useRef<() => boolean>(() => true);
  persistRef.current = () => saveJSON(ls, 'settings', settings) && saveJSON(ls, 'presets', presets) && saveJSON(ls, 'character', character) && saveJSON(ls, 'theme', theme);
  useEffect(() => {
    const t = window.setTimeout(() => setStorageWarning(!persistRef.current()), 250);
    return () => window.clearTimeout(t);
  }, [ls, settings, presets, character, theme]);
  // Запись отложена на 250 мс, поэтому при закрытии или перезагрузке вкладки сохраняем сразу.
  useEffect(() => {
    const flush = () => void persistRef.current();
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);

  // ───────── тема ─────────
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#14161b' : '#f6f4ef');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  const setSettings = useCallback((fn: (s: Settings) => Settings) => setSettingsState((s) => normalizeSettings(fn(s)).settings), []);
  const setTheme = useCallback((t: ThemePref) => setThemeState(t), []);

  const features = useMemo<HistoryFeature[]>(() => history.map((e) => featuresOf(e.scenario)), [history]);
  const featuresRef = useRef(features);
  featuresRef.current = features;

  const deferred = useDeferredValue(settings);
  const feasible = useMemo(() => countFeasibleScenes(deferred), [deferred]);
  const report = useCallback(() => explainConstraints(settingsRef.current, currentRef.current?.scenario ?? null), []);

  const rendered = useMemo<Rendered | null>(
    () => (current ? renderScenario(current.scenario, { profile: settings.profile, length: settings.length, includeNegative: settings.includeNegative }) : null),
    [current, settings.profile, settings.length, settings.includeNegative],
  );

  // ───────── история ─────────
  const addEntries = useCallback((entries: HistoryEntry[]) => {
    const { kept, removed } = trimHistory([...entries, ...historyRef.current], settingsRef.current.historyLimit);
    historyRef.current = kept;
    setHistory(kept);
    const repo = repoRef.current;
    if (repo) {
      void repo.putMany(entries).catch(() => undefined);
      for (const r of removed) void repo.remove(r.id).catch(() => undefined);
    }
  }, []);

  const showResult = useCallback(
    (scenario: PhotoScenario, snap: Settings, diversity: DiversityReport | null, opts: { replaceInSeries?: boolean } = {}) => {
      const entry = makeEntry(scenario, snap);
      addEntries([entry]);
      setCurrent({ scenario, entryId: entry.id, diversity, settings: snap });
      if (opts.replaceInSeries) {
        setSeries((s) => (s ? { ...s, frames: s.frames.map((f, i) => (i === s.index ? { scenario, entryId: entry.id } : f)) } : s));
      } else setSeries(null);
      return entry;
    },
    [addEntries],
  );

  const createCharacter = useCallback(
    (sc: PhotoScenario) => {
      const n = (characterRef.current ? 1 : 0) + 1;
      const ch: Character = { id: `CH-${makeSeed().slice(3)}`, name: `Персонаж ${n}`, subject: sc.subject, createdAt: Date.now() };
      setCharacterState(ch);
      toast('Паспорт персонажа создан по этому кадру — дальше меняется только сценарий.', 'success');
    },
    [toast],
  );

  const run = useCallback(
    (s: Settings, freshSeed: boolean) => {
      const typed = s.seed.trim();
      const seed = !freshSeed && typed ? typed : makeSeed();
      setError(null);
      const prev = currentRef.current?.scenario ?? null;
      if (s.mode === 'series') {
        const res = generateSeries({ settings: s, seed, count: s.seriesLength, character: characterRef.current, history: featuresRef.current, prev });
        if (!res.scenarios.length) {
          setError({ reason: 'Не удалось собрать серию при текущих ограничениях.', hints: ['Ослабьте ручные ограничения или закрепления.'] });
          return;
        }
        const entries = res.scenarios.map((sc, i) => makeEntry(sc, s, i));
        addEntries([...entries].reverse());
        setSeries({ title: res.title, frames: res.scenarios.map((sc, i) => ({ scenario: sc, entryId: (entries[i] as HistoryEntry).id })), index: 0 });
        setCurrent({ scenario: res.scenarios[0] as PhotoScenario, entryId: (entries[0] as HistoryEntry).id, diversity: null, settings: s });
        if (res.failures) toast(`Серия собрана не полностью: ${res.scenarios.length} из ${s.seriesLength} кадров.`, 'info');
        return;
      }
      const out = generateScenario({ settings: s, seed, prev, history: featuresRef.current, character: s.mode === 'character' ? characterRef.current : null });
      if (!out.ok) {
        setError({ reason: out.reason, hints: out.hints });
        return;
      }
      const sc = out.result.scenario;
      showResult(sc, s, out.result.diversity);
      if (s.mode === 'character' && !characterRef.current) createCharacter(sc);
    },
    [addEntries, createCharacter, showResult, toast],
  );

  const generate = useCallback(() => run(settingsRef.current, false), [run]);
  const generateMore = useCallback(() => run(settingsRef.current, true), [run]);

  const repeat = useCallback(() => {
    const cur = currentRef.current;
    if (!cur) return run(settingsRef.current, false);
    const out = generateScenario({ settings: cur.settings, seed: cur.scenario.seed, prev: cur.scenario, history: [], attempt: cur.scenario.attempt, character: cur.scenario.mode === 'character' ? characterRef.current : null });
    if (!out.ok) {
      setError({ reason: out.reason, hints: out.hints });
      return;
    }
    const same = JSON.stringify(out.result.scenario) === JSON.stringify(cur.scenario);
    if (same) toast('Повтор дал идентичный результат: тот же seed и те же настройки.', 'success');
    else {
      toast('Кадр был изменён вручную — повторена исходная генерация по seed.', 'info');
      showResult(out.result.scenario, cur.settings, out.result.diversity);
    }
  }, [run, showResult, toast]);

  const randomizeAll = useCallback(() => {
    const next = normalizeSettings(randomizeSettings(settingsRef.current, makeSeed())).settings;
    setSettingsState(next);
    run(next, true);
    toast('Поля заполнены случайно — их можно изменить и сгенерировать снова.', 'info');
  }, [run, toast]);

  const resetSettings = useCallback(async () => {
    const ok = await confirm({ title: 'Сбросить настройки?', message: 'Все параметры вернутся к значениям по умолчанию. История, избранное, пресеты и персонаж сохранятся.', confirmLabel: 'Сбросить', danger: true });
    if (!ok) return;
    setSettingsState(defaultSettings());
    toast('Настройки сброшены.', 'success');
  }, [confirm, toast]);

  const toggleFavorite = useCallback((id: string) => {
    const e = historyRef.current.find((x) => x.id === id);
    if (!e) return;
    const next = { ...e, favorite: !e.favorite };
    const list = historyRef.current.map((x) => (x.id === id ? next : x));
    historyRef.current = list;
    setHistory(list);
    void repoRef.current?.put(next).catch(() => undefined);
  }, []);

  const toggleFavoriteCurrent = useCallback(() => {
    const cur = currentRef.current;
    if (!cur) return;
    if (cur.entryId && historyRef.current.some((e) => e.id === cur.entryId)) {
      toggleFavorite(cur.entryId);
      return;
    }
    const entry = { ...makeEntry(cur.scenario, cur.settings), favorite: true };
    addEntries([entry]);
    setCurrent({ ...cur, entryId: entry.id });
    toast('Сохранено в избранное.', 'success');
  }, [addEntries, toast, toggleFavorite]);

  // ───────── копирование и скачивание ─────────
  const rendersFor = useCallback(
    (kind: CopyKind): string => {
      const r = rendered;
      if (!r) return '';
      switch (kind) {
        case 'main':
          return r.main;
        case 'negative':
          return r.negative;
        case 'main+negative':
          return settings.profile === 'universal' ? `${r.main}\n\nNegative prompt: ${r.negative}` : r.main;
        case 'json':
          return r.json;
        case 'ru':
          return r.ru;
      }
    },
    [rendered, settings.profile],
  );

  const copy = useCallback(
    async (kind: CopyKind) => {
      const text = rendersFor(kind);
      if (!text) return;
      const ok = await copyText(text);
      toast(ok ? 'Скопировано в буфер обмена.' : 'Не удалось скопировать — выделите текст и скопируйте вручную.', ok ? 'success' : 'error');
    },
    [rendersFor, toast],
  );

  const entryFromCurrent = useCallback((): HistoryEntry | null => {
    const cur = currentRef.current;
    if (!cur || !rendered) return null;
    return {
      id: cur.entryId ?? 'current',
      createdAt: Date.now(),
      favorite: false,
      scenario: cur.scenario,
      settings: cur.settings,
      profile: settings.profile,
      length: settings.length,
      includeNegative: settings.includeNegative,
      main: rendered.main,
      negative: rendered.negative,
    };
  }, [rendered, settings.includeNegative, settings.length, settings.profile]);

  const downloadEntry = useCallback(
    (e: HistoryEntry, kind: 'txt' | 'json') => {
      if (kind === 'txt') downloadText(singleFilename(e, 'txt'), entryToTxt(e), 'text/plain');
      else downloadText(singleFilename(e, 'json'), entryToJson(e), 'application/json');
      toast('Файл подготовлен к скачиванию.', 'success');
    },
    [toast],
  );

  const download = useCallback(
    (kind: 'txt' | 'json') => {
      const e = entryFromCurrent();
      if (e) downloadEntry(e, kind);
    },
    [downloadEntry, entryFromCurrent],
  );

  const copyEntry = useCallback(
    async (e: HistoryEntry, withNegative: boolean) => {
      const text = withNegative && e.profile === 'universal' ? `${e.main}\n\nNegative prompt: ${e.negative}` : e.main;
      const ok = await copyText(text);
      toast(ok ? 'Скопировано в буфер обмена.' : 'Не удалось скопировать.', ok ? 'success' : 'error');
    },
    [toast],
  );

  // ───────── смена аспектов, правка, закрепления ─────────
  const reroll = useCallback(
    (aspect: RerollAspect) => {
      const cur = currentRef.current;
      if (!cur) return;
      rerollCounter.current += 1;
      const out = rerollAspect({ settings: settingsRef.current, scenario: cur.scenario, aspect, salt: String(rerollCounter.current), character: characterRef.current });
      if (!out.ok) {
        toast(out.reason, 'error');
        return;
      }
      showResult(out.result.scenario, cur.settings, null, { replaceInSeries: true });
    },
    [showResult, toast],
  );

  const edit = useCallback(
    (patch: ScenarioPatch): { ok: true } | { ok: false; reason: string } => {
      const cur = currentRef.current;
      if (!cur) return { ok: false, reason: 'Нет кадра для правки.' };
      const out = editScenario(settingsRef.current, cur.scenario, patch, characterRef.current);
      if (!out.ok) return { ok: false, reason: `${out.reason} ${out.hints[0] ?? ''}`.trim() };
      showResult(out.result.scenario, cur.settings, null, { replaceInSeries: true });
      toast('Сценарий обновлён, совместимость проверена.', 'success');
      return { ok: true };
    },
    [showResult, toast],
  );

  const toggleLock = useCallback(
    (key: LockKey) => {
      setSettings((s) => ({ ...s, locks: s.locks.includes(key) ? s.locks.filter((k) => k !== key) : [...s.locks, key] }));
    },
    [setSettings],
  );

  const pinSeed = useCallback(() => {
    const cur = currentRef.current;
    if (!cur) return;
    setSettings((s) => ({ ...s, seed: cur.scenario.seed }));
    toast('Seed закреплён: следующая генерация с ним даст тот же результат.', 'info');
  }, [setSettings, toast]);

  const selectSeriesFrame = useCallback((i: number) => {
    setSeries((s) => {
      if (!s || !s.frames[i]) return s;
      const f = s.frames[i];
      setCurrent((c) => (c ? { ...c, scenario: f.scenario, entryId: f.entryId } : c));
      return { ...s, index: i };
    });
  }, []);

  // ───────── персонаж ─────────
  const makeCharacter = useCallback(() => {
    const cur = currentRef.current;
    if (!cur) {
      toast('Сначала сгенерируйте кадр — паспорт персонажа создаётся по нему.', 'info');
      return;
    }
    createCharacter(cur.scenario);
    setSettings((s) => ({ ...s, mode: 'character' }));
  }, [createCharacter, setSettings, toast]);

  const renameCharacter = useCallback((name: string) => setCharacterState((c) => (c ? { ...c, name: cleanName(name) || c.name } : c)), []);

  const clearCharacter = useCallback(async () => {
    const ok = await confirm({ title: 'Удалить персонажа?', message: 'Паспорт внешности будет удалён. Следующий кадр в режиме «Один персонаж» создаст нового.', confirmLabel: 'Удалить', danger: true });
    if (ok) setCharacterState(null);
  }, [confirm]);

  const exportCharacter = useCallback(
    (kind: 'txt' | 'json') => {
      const ch = characterRef.current;
      if (!ch) return;
      if (kind === 'json') {
        downloadText(safeFilename(`realphoto-character-${ch.id}`, 'json'), JSON.stringify({ app: 'RealPhoto Prompt Studio', character: ch }, null, 2), 'application/json');
      } else {
        const p = ch.subject;
        const lines = [`Character sheet: ${ch.name} (${ch.id})`, 'Fictional adult woman; the ID exists only inside this app.', `Age: ${p.age}`, `Hair: ${p.hairLength}, ${p.hairType}, ${p.hairColor}`, `Eyes: ${p.eyeColor}`, `Skin: ${p.skinTone}`, `Build: ${p.build}, height: ${p.height}`, `Makeup: ${p.makeup}`, `Freckles: ${p.freckles}`, `Glasses: ${p.glasses}`, `Features: ${p.features.join(', ') || 'none'}`, '', 'Note: a text description cannot guarantee the same face in a third-party model.'];
        downloadText(safeFilename(`realphoto-character-${ch.id}`, 'txt'), `${lines.join('\n')}\n`, 'text/plain');
      }
      toast('Character sheet подготовлен к скачиванию.', 'success');
    },
    [toast],
  );

  // ───────── пресеты и конфигурация ─────────
  const applyPresetById = useCallback(
    (id: string) => {
      const p = [...BUILTIN_PRESETS, ...presets].find((x) => x.id === id);
      if (!p) return;
      setSettingsState((s) => normalizeSettings(applyPreset(s, p)).settings);
      toast(`Пресет «${p.name}» применён.`, 'success');
    },
    [presets, toast],
  );

  const savePreset = useCallback(
    (name: string): boolean => {
      const n = cleanName(name);
      if (!n) {
        toast('Введите название пресета.', 'error');
        return false;
      }
      if (presets.length >= MAX_USER_PRESETS) {
        toast(`Не больше ${MAX_USER_PRESETS} собственных пресетов.`, 'error');
        return false;
      }
      setPresets((p) => [...p, createPreset(n, settingsRef.current)]);
      toast(`Пресет «${n}» сохранён.`, 'success');
      return true;
    },
    [presets.length, toast],
  );

  const renamePresetById = useCallback((id: string, name: string) => setPresets((p) => renamePreset(p, id, name)), []);

  const deletePresetById = useCallback(
    async (id: string) => {
      const p = presets.find((x) => x.id === id);
      if (!p) return;
      const ok = await confirm({ title: 'Удалить пресет?', message: `Пресет «${p.name}» будет удалён без возможности восстановления.`, confirmLabel: 'Удалить', danger: true });
      if (ok) setPresets((list) => deletePreset(list, id));
    },
    [confirm, presets],
  );

  const downloadConfig = useCallback(() => {
    downloadText(safeFilename('realphoto-config', 'json'), exportConfig({ settings: settingsRef.current, presets, character: characterRef.current }), 'application/json');
    toast('Конфигурация подготовлена к скачиванию.', 'success');
  }, [presets, toast]);

  const importConfigText = useCallback(
    (text: string): { ok: boolean; message: string } => {
      const r = importConfig(text);
      if (!r.ok) {
        toast(r.error, 'error');
        return { ok: false, message: r.error };
      }
      setSettingsState(r.bundle.settings);
      setPresets((cur) => {
        const ids = new Set(cur.map((p) => p.id));
        return [...cur, ...r.bundle.presets.filter((p) => !ids.has(p.id))].slice(0, MAX_USER_PRESETS);
      });
      if (r.bundle.character) setCharacterState(r.bundle.character);
      const message = `Конфигурация импортирована${r.warnings.length ? `, предупреждений: ${r.warnings.length}` : ''}.`;
      toast(message, 'success');
      return { ok: true, message: [message, ...r.warnings].join(' ') };
    },
    [toast],
  );

  // ───────── история: операции ─────────
  const openEntry = useCallback(
    (id: string) => {
      const e = historyRef.current.find((x) => x.id === id);
      if (!e) return;
      setCurrent({ scenario: e.scenario, entryId: e.id, diversity: null, settings: e.settings });
      setSeries(null);
      setError(null);
      setView('studio');
    },
    [],
  );

  const removeEntry = useCallback(async (id: string) => {
    const list = historyRef.current.filter((e) => e.id !== id);
    historyRef.current = list;
    setHistory(list);
    await repoRef.current?.remove(id).catch(() => undefined);
    setCurrent((c) => (c && c.entryId === id ? { ...c, entryId: null } : c));
  }, []);

  const clearHistory = useCallback(async () => {
    const n = historyRef.current.length;
    if (!n) return;
    const fav = historyRef.current.filter((e) => e.favorite).length;
    const ok = await confirm({
      title: 'Очистить историю?',
      message: `Будет удалено записей: ${n}${fav ? `, включая избранные (${fav})` : ''}. Это действие нельзя отменить.`,
      confirmLabel: 'Очистить всё',
      danger: true,
    });
    if (!ok) return;
    historyRef.current = [];
    setHistory([]);
    await repoRef.current?.clear().catch(() => undefined);
    setCurrent((c) => (c ? { ...c, entryId: null } : c));
    toast('История очищена.', 'success');
  }, [confirm, toast]);

  const exportEntries = useCallback(
    (entries: HistoryEntry[], kind: 'csv' | 'json' | 'txt', label?: string) => {
      if (!entries.length) {
        toast('Нечего экспортировать.', 'info');
        return;
      }
      const name = label ? safeFilename(label, kind) : batchFilename(entries.length, kind);
      if (kind === 'csv') downloadText(name, entriesToCsv(entries), 'text/csv');
      else if (kind === 'json') downloadText(name, entriesToJson(entries), 'application/json');
      else downloadText(name, entriesToTxt(entries, settingsRef.current.includeNegative), 'text/plain');
      toast(`Файл ${name} подготовлен к скачиванию.`, 'success');
    },
    [toast],
  );

  // ───────── пакетная генерация ─────────
  const cancelBatch = useCallback(() => abortRef.current?.abort(), []);

  const startBatch = useCallback(
    async (count: number, addToHistory: boolean) => {
      if (abortRef.current && batch.running) return;
      const ac = new AbortController();
      abortRef.current = ac;
      const s = settingsRef.current;
      const base = s.seed.trim() || makeSeed();
      const items: HistoryEntry[] = [];
      setBatch({ ...EMPTY_BATCH, running: true, total: count });
      const res = await runBatch({
        settings: s,
        count,
        baseSeed: base,
        history: featuresRef.current,
        prev: currentRef.current?.scenario ?? null,
        character: s.mode === 'character' ? characterRef.current : null,
        signal: ac.signal,
        onProgress: (done, total, last) => {
          if (last) items.push(makeEntry(last, s, items.length));
          setBatch((b) => ({ ...b, running: true, done, total, items: [...items] }));
        },
      });
      if (addToHistory && items.length) addEntries([...items].reverse());
      setBatch({ running: false, done: res.scenarios.length + res.failures, total: count, items, cancelled: res.cancelled, title: res.title, failures: res.failures, tooStrict: res.tooStrict, finished: true });
      toast(res.cancelled ? `Пакет остановлен: готово ${items.length} из ${count}.` : `Пакет готов: ${items.length} из ${count}.`, res.cancelled ? 'info' : 'success');
    },
    [addEntries, batch.running, toast],
  );

  // Горячая клавиша Ctrl/⌘+Enter — «Сгенерировать».
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        run(settingsRef.current, false);
        setView('studio');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run]);

  const api: StudioApi = {
    settings,
    setSettings,
    settingsTab,
    setSettingsTab,
    view,
    setView,
    theme,
    setTheme,
    current,
    rendered,
    series,
    selectSeriesFrame,
    error,
    feasible,
    report,
    presets,
    builtinPresets: BUILTIN_PRESETS,
    character,
    history,
    historyReady,
    historyPersistent,
    storageWarning,
    batch,
    toasts,
    dismissToast,
    confirmState,
    confirm,
    generate,
    generateMore,
    repeat,
    randomizeAll,
    resetSettings,
    toggleFavoriteCurrent,
    copy,
    download,
    reroll,
    edit,
    toggleLock,
    pinSeed,
    makeCharacter,
    renameCharacter,
    clearCharacter,
    exportCharacter,
    applyPresetById,
    savePreset,
    renamePresetById,
    deletePresetById,
    downloadConfig,
    importConfigText,
    openEntry,
    toggleFavorite,
    removeEntry,
    clearHistory,
    exportEntries,
    copyEntry,
    downloadEntry,
    startBatch,
    cancelBatch,
    toast,
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

