// Воспроизводимый генератор случайных чисел: строка seed → независимые потоки по меткам.

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export interface Rng {
  readonly seed: string;
  /** Число в [0, 1). */
  next(): number;
  /** Целое в [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Целое в [min, max] включительно. */
  range(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Взвешенный выбор; веса ≤ 0 игнорируются; undefined, если выбрать нечего. */
  weighted<T>(items: readonly T[], weight: (item: T, index: number) => number): T | undefined;
  shuffle<T>(items: readonly T[]): T[];
  /** Независимый поток для отдельного аспекта. */
  fork(label: string): Rng;
}

export function createRng(seed: string): Rng {
  const g = xmur3(seed);
  const f = sfc32(g(), g(), g(), g());
  for (let i = 0; i < 12; i++) f();
  const rng: Rng = {
    seed,
    next: f,
    int(maxExclusive) {
      return maxExclusive <= 1 ? 0 : Math.floor(f() * maxExclusive);
    },
    range(min, max) {
      return min + Math.floor(f() * (max - min + 1));
    },
    chance(p) {
      return f() < p;
    },
    pick(items) {
      if (items.length === 0) throw new Error('pick: пустой список');
      return items[Math.floor(f() * items.length)] as never;
    },
    weighted(items, weight) {
      let total = 0;
      const ws = items.map((it, i) => {
        const w = weight(it, i);
        const v = Number.isFinite(w) && w > 0 ? w : 0;
        total += v;
        return v;
      });
      if (total <= 0) return undefined;
      let r = f() * total;
      for (let i = 0; i < items.length; i++) {
        r -= ws[i] as number;
        if (r < 0) return items[i];
      }
      for (let i = items.length - 1; i >= 0; i--) if ((ws[i] as number) > 0) return items[i];
      return undefined;
    },
    shuffle(items) {
      const a = [...items];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(f() * (i + 1));
        [a[i], a[j]] = [a[j] as never, a[i] as never];
      }
      return a;
    },
    fork(label) {
      return createRng(`${seed}::${label}`);
    },
  };
  return rng;
}

const SEED_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Новый случайный seed вида RP-7K3M9Q2X (источник — crypto, если доступен). */
export function makeSeed(): string {
  const bytes = new Uint8Array(8);
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  let s = 'RP-';
  for (const b of bytes) s += SEED_ALPHABET[b % SEED_ALPHABET.length];
  return s;
}

/** Небольшой стабильный хеш для идентификаторов. */
export function shortHash(text: string): string {
  const g = xmur3(text);
  return g().toString(36).padStart(7, '0').slice(0, 7);
}

/** Нормализация долей к сумме 1 (если сумма 0 — равномерно). */
export function normalizeShares<K extends string>(shares: Record<K, number>): Record<K, number> {
  const keys = Object.keys(shares) as K[];
  const clean = keys.map((k) => Math.max(0, Number.isFinite(shares[k]) ? shares[k] : 0));
  const total = clean.reduce((a, b) => a + b, 0);
  const out = {} as Record<K, number>;
  keys.forEach((k, i) => {
    out[k] = total > 0 ? (clean[i] as number) / total : 1 / keys.length;
  });
  return out;
}
