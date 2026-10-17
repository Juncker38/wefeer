import type { PhotoScenario } from '../core/types.ts';
import type { Settings } from '../core/settings.ts';
import type { Length, Profile } from '../core/vocab.ts';

/** Запись истории: сохраняет seed, все параметры сценария, снимок настроек и итоговый текст. */
export interface HistoryEntry {
  id: string;
  createdAt: number;
  favorite: boolean;
  scenario: PhotoScenario;
  settings: Settings;
  profile: Profile;
  length: Length;
  includeNegative: boolean;
  main: string;
  negative: string;
}

export interface HistoryFilter {
  query?: string;
  favoritesOnly?: boolean;
  mode?: PhotoScenario['mode'] | 'all';
  category?: PhotoScenario['category'] | 'all';
  season?: PhotoScenario['season'] | 'all';
  capture?: PhotoScenario['capture'] | 'all';
}

export interface HistoryRepo {
  readonly persistent: boolean;
  list(): Promise<HistoryEntry[]>;
  put(entry: HistoryEntry): Promise<void>;
  putMany(entries: readonly HistoryEntry[]): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export function entrySearchText(e: HistoryEntry): string {
  const s = e.scenario;
  return [e.main, e.negative, s.seed, s.id, s.sceneTitle, s.action.ru, s.outfit.ru, e.id].join(' ').toLowerCase();
}

export function filterHistory(entries: readonly HistoryEntry[], f: HistoryFilter): HistoryEntry[] {
  const q = (f.query ?? '').trim().toLowerCase();
  const words = q ? q.split(/\s+/) : [];
  return entries.filter((e) => {
    if (f.favoritesOnly && !e.favorite) return false;
    if (f.mode && f.mode !== 'all' && e.scenario.mode !== f.mode) return false;
    if (f.category && f.category !== 'all' && e.scenario.category !== f.category) return false;
    if (f.season && f.season !== 'all' && e.scenario.season !== f.season) return false;
    if (f.capture && f.capture !== 'all' && e.scenario.capture !== f.capture) return false;
    if (words.length) {
      const text = entrySearchText(e);
      return words.every((w) => text.includes(w));
    }
    return true;
  });
}

/** Оставляет не более limit записей: сначала удаляются самые старые неизбранные. */
export function trimHistory(entries: readonly HistoryEntry[], limit: number): { kept: HistoryEntry[]; removed: HistoryEntry[] } {
  const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);
  if (sorted.length <= limit) return { kept: sorted, removed: [] };
  const removed: HistoryEntry[] = [];
  let excess = sorted.length - limit;
  for (let i = sorted.length - 1; i >= 0 && excess > 0; i--) {
    const e = sorted[i] as HistoryEntry;
    if (!e.favorite) {
      removed.push(e);
      excess -= 1;
    }
  }
  const drop = new Set(removed.map((e) => e.id));
  return { kept: sorted.filter((e) => !drop.has(e.id)), removed };
}

export function createMemoryRepo(): HistoryRepo {
  const map = new Map<string, HistoryEntry>();
  return {
    persistent: false,
    async list() {
      return [...map.values()].map((e) => structuredClone(e)).sort((a, b) => b.createdAt - a.createdAt);
    },
    async put(e) {
      map.set(e.id, structuredClone(e));
    },
    async putMany(es) {
      for (const e of es) map.set(e.id, structuredClone(e));
    },
    async remove(id) {
      map.delete(id);
    },
    async clear() {
      map.clear();
    },
  };
}

const DB_NAME = 'realphoto-studio';
const STORE = 'history';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB error'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction error'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('IndexedDB open error'));
    open.onblocked = () => reject(new Error('IndexedDB заблокирована другой вкладкой'));
  });
}

/** Хранилище на IndexedDB; если оно недоступно, история живёт только в памяти. */
export async function createRepo(): Promise<HistoryRepo> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('no indexedDB');
    const db = await openDb();
    const run = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => Promise<T> | T): Promise<T> => {
      const tx = db.transaction(STORE, mode);
      const done = txDone(tx);
      const result = await fn(tx.objectStore(STORE));
      await done;
      return result;
    };
    return {
      persistent: true,
      async list() {
        const all = await run('readonly', (s) => req(s.getAll() as IDBRequest<HistoryEntry[]>));
        return all.sort((a, b) => b.createdAt - a.createdAt);
      },
      async put(e) {
        await run('readwrite', (s) => req(s.put(e)));
      },
      async putMany(es) {
        await run('readwrite', async (s) => {
          for (const e of es) s.put(e);
        });
      },
      async remove(id) {
        await run('readwrite', (s) => req(s.delete(id)));
      },
      async clear() {
        await run('readwrite', (s) => req(s.clear()));
      },
    };
  } catch {
    return createMemoryRepo();
  }
}
