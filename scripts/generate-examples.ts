// Генерирует EXAMPLES.md: 20 воспроизводимых промптов + короткая серия. Запуск: npm run examples
// Все примеры получены движком без истории; seed и отличия настроек от умолчаний указаны в документе.
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { L_CAPTURE, L_SEASON, L_TIME, L_WEATHER } from '../src/core/labels.ts';
import { defaultSettings } from '../src/core/settings.ts';
import type { Settings } from '../src/core/settings.ts';
import type { Capture } from '../src/core/vocab.ts';
import { ALL_SCENES } from '../src/data/scenes/index.ts';
import { ENGINE_VERSION } from '../src/engine/compose.ts';
import { generateScenario } from '../src/engine/generate.ts';
import { generateSeries } from '../src/engine/series.ts';
import { validateScenario } from '../src/engine/validate.ts';
import { renderScenario } from '../src/render/render.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

interface Example {
  title: string;
  seed: string;
  settings: string;
  patch?: (s: Settings) => void;
}

const only = (s: Settings, ...captures: Capture[]) => {
  for (const key of Object.keys(s.captureShares) as Capture[]) s.captureShares[key] = captures.includes(key) ? 100 : 0;
};

const EXAMPLES: Example[] = [
  { title: 'Базовый кадр', seed: 'ex-01', settings: 'по умолчанию' },
  { title: 'Утро дома', seed: 'ex-02', settings: 'категория «Дом», время — утро', patch: (s) => ((s.choices.category = { mode: 'manual', values: ['home'] }), (s.choices.time = { mode: 'manual', values: ['morning'] })) },
  { title: 'Город зимним вечером', seed: 'ex-03', settings: 'категория «Город», сезон — зима, время — вечер', patch: (s) => ((s.choices.category = { mode: 'manual', values: ['city'] }), (s.choices.season = { mode: 'manual', values: ['winter'] }), (s.choices.time = { mode: 'manual', values: ['evening'] })) },
  { title: 'Кафе и еда', seed: 'ex-04', settings: 'категория «Еда и напитки»', patch: (s) => (s.choices.category = { mode: 'manual', values: ['food'] }) },
  { title: 'Природа летним днём', seed: 'ex-05', settings: 'категория «Природа», сезон — лето, время — день', patch: (s) => ((s.choices.category = { mode: 'manual', values: ['nature'] }), (s.choices.season = { mode: 'manual', values: ['summer'] }), (s.choices.time = { mode: 'manual', values: ['day'] })) },
  { title: 'Вода и спорт', seed: 'ex-06', settings: 'категория «Вода и спорт»', patch: (s) => (s.choices.category = { mode: 'manual', values: ['water-sport'] }) },
  { title: 'Путешествие', seed: 'ex-07', settings: 'категория «Путешествия»', patch: (s) => (s.choices.category = { mode: 'manual', values: ['travel'] }) },
  { title: 'Повседневные дела', seed: 'ex-08', settings: 'категория «Повседневность»', patch: (s) => (s.choices.category = { mode: 'manual', values: ['everyday'] }) },
  { title: 'Только селфи на вытянутой руке', seed: 'ex-09', settings: 'доля типов съёмки: только «селфи на вытянутой руке»', patch: (s) => only(s, 'selfie-arm') },
  { title: 'Снимает знакомый', seed: 'ex-10', settings: 'доля типов съёмки: только «снимает знакомый»', patch: (s) => only(s, 'by-acquaintance') },
  { title: 'Горизонтальный кадр 16:9', seed: 'ex-11', settings: 'формат кадра 16:9', patch: (s) => (s.ratio = { mode: 'preset', preset: '16:9', custom: s.ratio.custom }) },
  { title: 'Вертикальный кадр, лицо видно', seed: 'ex-12', settings: 'формат 9:16, «Лицо обязательно видно»', patch: (s) => ((s.ratio = { mode: 'preset', preset: '9:16', custom: s.ratio.custom }), (s.faceRequired = true)) },
  { title: 'Ночная съёмка', seed: 'ex-13', settings: 'время — ночь', patch: (s) => (s.choices.time = { mode: 'manual', values: ['night'] }) },
  { title: 'Дождь', seed: 'ex-14', settings: 'погода — дождь', patch: (s) => (s.choices.weather = { mode: 'manual', values: ['rain'] }) },
  { title: 'Осень, золотой час', seed: 'ex-15', settings: 'сезон — осень, время — золотой час', patch: (s) => ((s.choices.season = { mode: 'manual', values: ['autumn'] }), (s.choices.time = { mode: 'manual', values: ['golden-hour'] })) },
  { title: 'Точный возраст 40', seed: 'ex-16', settings: 'возраст — ровно 40', patch: (s) => (s.age = { min: 40, max: 40, exact: 40 }) },
  { title: 'Возраст 20–24', seed: 'ex-17', settings: 'возраст от 20 до 24', patch: (s) => (s.age = { min: 20, max: 24, exact: null }) },
  { title: 'Короткий промпт', seed: 'ex-18', settings: 'длина — короткая', patch: (s) => (s.length = 'short') },
  { title: 'Подробный промпт, стиль «плёнка»', seed: 'ex-19', settings: 'длина — подробная, стиль — плёнка, детализация — высокая', patch: (s) => ((s.length = 'detailed'), (s.style = 'film'), (s.detailLevel = 'high')) },
  { title: 'Реализм без украшений', seed: 'ex-20', settings: 'баланс — «Реализм», спонтанность 85', patch: (s) => ((s.balance = 'realism'), (s.spontaneity = 85)) },
];

const lines: string[] = [];
const push = (...l: string[]) => lines.push(...l);

push(
  '# Примеры промптов',
  '',
  `Файл создан командой \`npm run examples\` (скрипт \`scripts/generate-examples.ts\`, движок ${ENGINE_VERSION}). Библиотека — ${ALL_SCENES.length} микросцен.`,
  'Каждый пример получен движком **без истории**, каждый сценарий прошёл проверку согласованности (`validateScenario`). Абсолютная уникальность не гарантируется: движок лишь снижает вероятность повторов.',
  '',
  'Чтобы воспроизвести пример в приложении: «Студия» → «Расширенные параметры» → поле seed → укажите значение из примера, задайте перечисленные настройки (остальные — по умолчанию), очистите историю и нажмите «Сгенерировать».',
  '',
);

let index = 0;
for (const ex of EXAMPLES) {
  index += 1;
  const settings = defaultSettings();
  ex.patch?.(settings);
  const out = generateScenario({ settings, seed: ex.seed });
  if (!out.ok) throw new Error(`${ex.seed}: ${out.reason}`);
  const sc = out.result.scenario;
  const problems = validateScenario(sc);
  if (problems.length) throw new Error(`${ex.seed}: ${problems.map((p) => p.message).join('; ')}`);
  const r = renderScenario(sc, { profile: settings.profile, length: settings.length, includeNegative: settings.includeNegative });
  if (r.problems.length) throw new Error(`${ex.seed}: ${r.problems.join('; ')}`);
  push(
    `## ${index}. ${ex.title}`,
    '',
    `- **Seed:** \`${ex.seed}\` · **настройки:** ${ex.settings}`,
    `- **Сцена:** ${sc.sceneTitle} (\`${sc.sceneId}\`) · ${L_SEASON[sc.season].toLowerCase()}, ${sc.weather ? L_WEATHER[sc.weather].toLowerCase() + ', ' : ''}${L_TIME[sc.time].toLowerCase()}`,
    `- **Съёмка:** ${L_CAPTURE[sc.capture].toLowerCase()} · формат ${sc.ratio.label} · возраст ${sc.subject.age}`,
    '',
    '```text',
    r.main,
    '```',
    '',
    `Negative: \`${r.negative}\``,
    '',
  );
}

const seriesSettings = defaultSettings();
seriesSettings.mode = 'series';
const series = generateSeries({ settings: seriesSettings, seed: 'ex-series', count: 3 });
push(
  '## Бонус: серия из трёх кадров',
  '',
  `Режим «Серия кадров», seed \`ex-series\`, тема: ${series.title}. Один персонаж, разные локации и ракурсы.`,
  '',
);
series.scenarios.forEach((sc, i) => {
  const problems = validateScenario(sc);
  if (problems.length) throw new Error(`series ${i}: ${problems.map((p) => p.message).join('; ')}`);
  const r = renderScenario(sc, { profile: seriesSettings.profile, length: seriesSettings.length, includeNegative: false });
  push(`### Кадр ${i + 1}: ${sc.sceneTitle}`, '', '```text', r.main, '```', '');
});

writeFileSync(join(root, 'EXAMPLES.md'), lines.join('\n'), 'utf8');
console.log(`EXAMPLES.md: ${EXAMPLES.length} промптов + серия из ${series.scenarios.length}`);
