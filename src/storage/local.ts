// Небольшие настройки приложения лежат в localStorage с префиксом и версией схемы.

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PREFIX = 'realphoto:v1:';

export function browserStore(): KeyValueStore | null {
  try {
    const ls = globalThis.localStorage;
    const probe = `${PREFIX}probe`;
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

export function memoryStore(): KeyValueStore {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

export function loadJSON<T>(store: KeyValueStore | null, key: string, fallback: T): T {
  if (!store) return fallback;
  try {
    const raw = store.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/** false — записать не удалось (переполнение квоты, приватный режим). */
export function saveJSON(store: KeyValueStore | null, key: string, value: unknown): boolean {
  if (!store) return false;
  try {
    store.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(store: KeyValueStore | null, key: string): void {
  try {
    store?.removeItem(PREFIX + key);
  } catch {
    /* хранилище недоступно */
  }
}
