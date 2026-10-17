import type { Character, HistoryFeature, PhotoScenario } from '../core/types.ts';
import type { Settings } from '../core/settings.ts';
import { generateScenario } from './generate.ts';
import { createSeriesRunner } from './series.ts';
import { featuresOf } from './similarity.ts';

export interface BatchOptions {
  settings: Settings;
  count: number;
  baseSeed: string;
  history?: readonly HistoryFeature[];
  prev?: PhotoScenario | null;
  character?: Character | null;
  signal?: AbortSignal | undefined;
  onProgress?: ((done: number, total: number, last: PhotoScenario | null) => void) | undefined;
  /** Через сколько кадров отдавать управление интерфейсу. */
  yieldEvery?: number;
  /** Подмена паузы (в тестах). */
  pause?: () => Promise<void>;
}

export interface BatchResult {
  scenarios: PhotoScenario[];
  cancelled: boolean;
  failures: number;
  /** Сколько кадров получены при «слишком жёстких» ограничениях (повторы неизбежны). */
  tooStrict: number;
  title: string | null;
}

const defaultPause = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

export const BATCH_SIZES = [1, 5, 10, 20, 50, 100] as const;

export function clampBatchCount(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(100, Math.max(1, Math.round(n)));
}

/** Пакетная генерация 1–100 с прогрессом, отменой и уступкой управления интерфейсу. */
export async function runBatch(o: BatchOptions): Promise<BatchResult> {
  const total = clampBatchCount(o.count);
  const yieldEvery = Math.max(1, o.yieldEvery ?? 4);
  const pause = o.pause ?? defaultPause;
  const scenarios: PhotoScenario[] = [];
  let failures = 0;
  let tooStrict = 0;
  let title: string | null = null;
  const series = o.settings.mode === 'series' ? createSeriesRunner({ settings: o.settings, seed: o.baseSeed, count: total, character: o.character ?? null, history: o.history ?? [], prev: o.prev ?? null }) : null;
  if (series) title = series.title;

  for (let i = 0; i < total; i++) {
    if (o.signal?.aborted) return { scenarios, cancelled: true, failures, tooStrict, title };
    let sc: PhotoScenario | null = null;
    if (series) {
      sc = series.step(i);
    } else {
      const history = [...scenarios.map(featuresOf).reverse(), ...(o.history ?? [])];
      const out = generateScenario({
        settings: o.settings,
        seed: `${o.baseSeed}-${i + 1}`,
        history,
        prev: o.prev ?? null,
        character: o.character ?? null,
        index: i,
      });
      if (out.ok) {
        sc = out.result.scenario;
        if (out.result.diversity.tooStrict) tooStrict += 1;
      }
    }
    if (sc) scenarios.push(sc);
    else failures += 1;
    o.onProgress?.(i + 1, total, sc);
    if ((i + 1) % yieldEvery === 0) await pause();
  }
  return { scenarios, cancelled: false, failures, tooStrict, title };
}
