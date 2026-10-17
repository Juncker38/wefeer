import type { PhotoScenario } from '../core/types.ts';
import { defaultSettings } from '../core/settings.ts';
import type { Settings } from '../core/settings.ts';
import { preparePlan } from './compose.ts';
import { resolveSettings } from './context.ts';
import { ALL_SCENES } from '../data/scenes/index.ts';

export interface ConstraintReport {
  totalScenes: number;
  feasibleScenes: number;
  lockedCount: number;
  /** Насколько вырастет число сцен, если снять группу ограничений. */
  families: { id: string; title: string; scenes: number; gain: number }[];
  messages: string[];
}

/** Быстрый подсчёт локаций, доступных при текущих настройках. */
export function countFeasibleScenes(settings: Settings): number {
  return preparePlan(resolveSettings(settings), {}).candidates.length;
}

type Relax = { id: string; title: string; apply: (s: Settings) => Settings };

const RELAXATIONS: Relax[] = [
  { id: 'place', title: 'Категории и ручной выбор локаций', apply: (s) => ({ ...s, choices: { ...s.choices, category: { mode: 'auto', values: [] }, scene: { mode: 'auto', values: [] } } }) },
  { id: 'season', title: 'Сезон', apply: (s) => ({ ...s, choices: { ...s.choices, season: { mode: 'auto', values: [] } } }) },
  { id: 'weather', title: 'Погода', apply: (s) => ({ ...s, choices: { ...s.choices, weather: { mode: 'auto', values: [] } } }) },
  { id: 'time', title: 'Время суток', apply: (s) => ({ ...s, choices: { ...s.choices, time: { mode: 'auto', values: [] } } }) },
  { id: 'capture', title: 'Доли типов съёмки', apply: (s) => ({ ...s, captureShares: defaultSettings().captureShares }) },
  { id: 'framing', title: 'Кадрирование', apply: (s) => ({ ...s, choices: { ...s.choices, framing: { mode: 'auto', values: [] } } }) },
  { id: 'angle', title: 'Ракурс и «Лицо обязательно видно»', apply: (s) => ({ ...s, faceRequired: false, choices: { ...s.choices, angle: { mode: 'auto', values: [] } } }) },
  { id: 'ratio', title: 'Формат кадра и ориентация', apply: (s) => ({ ...s, orientation: 'auto', ratio: defaultSettings().ratio }) },
  { id: 'posture', title: 'Поза', apply: (s) => ({ ...s, choices: { ...s.choices, posture: { mode: 'auto', values: [] } } }) },
  { id: 'crowd', title: 'Запрет людей на фоне', apply: (s) => ({ ...s, backgroundPeople: true }) },
];

/** Объясняет, почему вариантов мало: какие группы ограничений сильнее всего сужают библиотеку. */
export function explainConstraints(settings: Settings, prev?: PhotoScenario | null): ConstraintReport {
  const total = ALL_SCENES.length;
  const feasible = countFeasibleScenes(settings);
  const families = RELAXATIONS.map((r) => {
    const n = countFeasibleScenes(r.apply(settings));
    return { id: r.id, title: r.title, scenes: n, gain: n - feasible };
  })
    .filter((f) => f.gain > 0)
    .sort((a, b) => b.gain - a.gain);
  const lockedCount = prev ? settings.locks.length : 0;
  const messages: string[] = [];
  if (settings.mode === 'chaos') {
    messages.push('В режиме «Полный рандом» ручные ограничения не применяются.');
  } else if (feasible === 0) {
    const top = families.slice(0, 3).map((f) => `«${f.title}» (+${f.gain})`).join(', ');
    messages.push(`Нет ни одной подходящей локации.${top ? ` Сильнее всего мешают: ${top}.` : ''}`);
  } else if (feasible < 25) {
    const top = families[0];
    messages.push(`Доступно всего ${feasible} локаций из ${total} — повторы будут частыми.${top ? ` Если ослабить «${top.title}», доступно станет ${top.scenes}.` : ''}`);
  }
  if (lockedCount > 0) messages.push(`Закреплено параметров: ${lockedCount} — разнообразие закономерно снижается.`);
  return { totalScenes: total, feasibleScenes: feasible, lockedCount, families, messages };
}
