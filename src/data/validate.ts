import type { Scene, SceneInput } from '../core/types.ts';
import { safetyProblems } from '../core/safety.ts';
import {
  ANGLES,
  CATEGORIES,
  CLIMATES,
  OUTFIT_TAGS,
  POSTURES,
  SCENE_TAGS,
  SEASONS,
  TIMES,
  WEATHERS,
} from '../core/vocab.ts';
import type { Category } from '../core/vocab.ts';
import { sceneTriples } from '../engine/climate.ts';
import { normalizeScene, parseWhen } from './scenes/define.ts';

export const ID_PREFIX: Record<Category, string> = {
  home: 'home',
  city: 'city',
  food: 'food',
  nature: 'nature',
  'water-sport': 'water',
  travel: 'travel',
  everyday: 'everyday',
};

interface Axes {
  se: readonly string[];
  we: readonly string[];
  ti: readonly string[];
}

const subset = (a: readonly string[], b: readonly string[]): boolean => a.length > 0 && a.every((x) => b.includes(x));
const inter = (a: readonly string[], b: readonly string[]): string[] => a.filter((x) => b.includes(x));

interface Rule {
  name: string;
  re: RegExp;
  ok: (a: Axes, tags: readonly string[]) => boolean;
  hint: string;
}

// Безусловный текст не должен «ломаться» при любой допустимой для сцены погоде, сезоне и времени.
const RULES: Rule[] = [
  {
    name: 'дождь',
    re: /\b(rain\w*|drizzl\w*|downpour|puddles?|umbrellas?|raincoats?|raindrops?)\b/i,
    ok: (a) => subset(a.we, ['rain', 'after-rain']),
    hint: 'про дождь пишите только в условной детали (w:rain,after-rain)',
  },
  {
    name: 'влага',
    re: /\b(wet|damp|soaked|drenched|slippery)\b/i,
    ok: (a, tags) => tags.includes('water') || subset(a.we, ['rain', 'after-rain']),
    hint: 'мокрые поверхности — условная деталь; у «водных» сцен используйте тег water или слова dripping/beaded',
  },
  {
    name: 'снег/лёд',
    re: /\b(snow\w*|ice|icy|icicles?|frost\w*|frozen|slush|sleet|sled\w*|skis?|skiing|skates?|skating)\b/i,
    ok: (a) => subset(a.se, ['winter']),
    hint: 'снег и лёд допустимы без условия только в сценах, где se: [winter]',
  },
  {
    name: 'туман',
    re: /\b(fog\w*|mist\w*|hazy|haze)\b/i,
    ok: (a) => subset(a.we, ['fog']),
    hint: 'туман — только условная деталь (w:fog)',
  },
  {
    name: 'солнце/луна',
    re: /\b(sun|sunny|sunlit|sunlight|sunbeams?|sunshine|sunset|sunrise|sundown|moon\w*|stars?|starry|golden|glare)\b/i,
    ok: () => false,
    hint: 'свет задают время суток и погода; не упоминайте солнце, луну, закат и «золотой» цвет',
  },
  {
    name: 'вечер/ночь',
    re: /\b(night\w*|midnight|dusk|twilight|evening|nightfall)\b/i,
    ok: (a) => subset(a.ti, ['dusk', 'evening', 'night']),
    hint: 'слова о вечере/ночи — только если все времена сцены вечерние/ночные или в условной детали (t:...)',
  },
  {
    name: 'утро',
    re: /\b(morning\w*|dawn|daybreak|breakfast)\b/i,
    ok: (a) => subset(a.ti, ['dawn', 'morning']),
    hint: 'слова об утре — только если все времена сцены утренние или в условной детали (t:dawn,morning)',
  },
  {
    name: 'осень',
    re: /\b(autumn\w*|fallen leaves|fall leaves|leaf litter|foliage|conkers?|acorns?)\b/i,
    ok: (a) => subset(a.se, ['autumn']),
    hint: 'осенние детали — условные (s:autumn)',
  },
  {
    name: 'весна',
    re: /\b(spring\w*|blossom\w*|buds?|budding)\b/i,
    ok: (a) => subset(a.se, ['spring']),
    hint: 'весенние детали — условные (s:spring)',
  },
  {
    name: 'лето',
    re: /\b(summer\w*)\b/i,
    ok: (a) => subset(a.se, ['summer']),
    hint: 'летние детали — условные (s:summer)',
  },
  {
    name: 'зима',
    re: /\b(winter\w*|wintry)\b/i,
    ok: (a) => subset(a.se, ['winter']),
    hint: 'зимние детали — условные (s:winter)',
  },
  {
    name: 'жара',
    re: /\b(scorching|sweat\w*|sweltering|sunburn\w*)\b/i,
    ok: (a) => subset(a.we, ['heat']),
    hint: 'жара — только условная деталь (w:heat)',
  },
  {
    name: 'голые деревья',
    re: /\bbare (trees?|branches|twigs)\b/i,
    ok: (a) => subset(a.se, ['autumn', 'winter']),
    hint: 'голые ветви — условная деталь (s:autumn,winter)',
  },
  {
    name: 'холод',
    re: /\b(freezing|chilly|shiver\w*|steaming breath)\b/i,
    ok: (a) => subset(a.se, ['autumn', 'winter']),
    hint: 'холод — условная деталь (s:autumn,winter)',
  },
  {
    name: 'включённый свет',
    re: /\b(lights? (?:are )?on|glowing windows|lit windows|neon)\b/i,
    ok: (a) => subset(a.ti, ['dusk', 'evening', 'night']),
    hint: 'включённое освещение — условная деталь (t:dusk,evening,night)',
  },
];

export function formatProblems(label: string, text: unknown, min: number, max: number): string[] {
  if (typeof text !== 'string') return [`${label}: не строка`];
  const p: string[] = [];
  if (text !== text.trim()) p.push(`${label}: лишние пробелы по краям`);
  if (text.length < min || text.length > max) p.push(`${label}: длина ${text.length}, допустимо ${min}–${max}`);
  if (/\s{2,}/.test(text)) p.push(`${label}: двойные пробелы`);
  if (/[.;:!?]$/.test(text) || /[\n\r;]/.test(text)) p.push(`${label}: без точки в конце, без «;» и переносов строк`);
  if (/^[A-Z]/.test(text)) p.push(`${label}: начинайте со строчной буквы`);
  if (/\d/.test(text)) p.push(`${label}: без цифр (числа — словами)`);
  for (const m of safetyProblems(text)) p.push(`${label}: ${m}`);
  return p;
}

export function neutralityProblems(label: string, text: string, axes: Axes, tags: readonly string[]): string[] {
  const p: string[] = [];
  for (const rule of RULES) {
    const m = rule.re.exec(text);
    if (m && !rule.ok(axes, tags)) p.push(`${label}: «${m[0]}» (${rule.name}) — ${rule.hint}`);
  }
  return p;
}

const PLACE_RE =
  /^(in|on|at|inside|along|by|near|under|beside|outside|across|over|among|beneath|aboard|within|between|next to|through|around|atop|alongside|behind|beyond|above|below|beneath|against|at the edge of) /;
const ING_RE = /^[a-z]+ing\b/;
const CYRILLIC_RE = /[А-Яа-яЁё]/;

export const SELFIE_POSTURES = ['stand', 'sit', 'lean', 'walk'] as const;

export function isSelfieFriendly(a: { posture: string; hands: number; back: boolean; hidden: boolean; obj: boolean }): boolean {
  return !a.back && !a.hidden && !a.obj && a.hands <= 1 && (SELFIE_POSTURES as readonly string[]).includes(a.posture);
}

/** Проверка одной сцены авторского формата. Пустой массив — всё хорошо. */
export function validateSceneInput(input: SceneInput): string[] {
  const out: string[] = [];
  const id = typeof input?.id === 'string' ? input.id : '???';
  const add = (m: string) => out.push(`[${id}] ${m}`);
  if (typeof input !== 'object' || input === null) return ['[???] сцена — не объект'];

  if (typeof input.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.id)) add('id: kebab-case латиницей');
  if (!(CATEGORIES as readonly string[]).includes(input.cat)) add(`cat: неизвестная категория «${String(input.cat)}»`);
  else if (!input.id.startsWith(`${ID_PREFIX[input.cat]}-`)) add(`id должен начинаться с «${ID_PREFIX[input.cat]}-»`);
  if (!['c', 'u', 'r'].includes(input.rar)) add('rar: c | u | r');
  if (typeof input.ru !== 'string' || !CYRILLIC_RE.test(input.ru) || input.ru.length < 4 || input.ru.length > 60) {
    add('ru: русское название 4–60 символов');
  }
  if (!['in', 'out', 'cov'].includes(input.env)) add('env: in | out | cov');
  if (!['open', 'win', 'none'].includes(input.view)) add('view: open | win | none');
  if (input.env === 'in' && input.view === 'open') add('в помещении view не может быть open (используйте win или none)');
  if (input.env !== 'in' && input.view !== 'open') add('на улице и под навесом view должен быть open');
  if (input.dress && !['in', 'out'].includes(input.dress)) add('dress: in | out');

  out.push(...formatProblems(`[${id}] place`, input.place, 18, 170));
  if (typeof input.place === 'string' && !PLACE_RE.test(input.place)) add('place: начинайте с предлога места (in/on/at/inside/along/by/near/under/beside…)');

  // Сезоны, погода, время
  const se = input.se ?? [];
  const ti = input.ti ?? [];
  if (!se.length || se.some((s) => !(SEASONS as readonly string[]).includes(s)) || new Set(se).size !== se.length) add('se: непустой список уникальных сезонов');
  if (!ti.length || ti.some((t) => !(TIMES as readonly string[]).includes(t)) || new Set(ti).size !== ti.length) add('ti: непустой список уникальных времён суток');
  if (input.view !== 'none') {
    const we = input.we ?? [];
    if (!we.length || we.some((w) => !(WEATHERS as readonly string[]).includes(w)) || new Set(we).size !== we.length) {
      add('we: непустой список уникальных видов погоды (для сцен с видом наружу)');
    }
  }
  if (input.view === 'none' && ti.some((t) => !['morning', 'day', 'evening', 'night'].includes(t))) {
    add('сцена без вида наружу: ti только из morning/day/evening/night');
  }
  const hasDark = ti.some((t) => t === 'dusk' || t === 'evening' || t === 'night');
  if (hasDark && !input.night) add('night: обязателен, если во ti есть dusk/evening/night');

  const tags = input.tags ?? [];
  if (tags.some((t) => !(SCENE_TAGS as readonly string[]).includes(t))) add(`tags: допустимы только ${SCENE_TAGS.join(', ')}`);

  const weatherAxis = input.view === 'none' ? [...WEATHERS] : [...(input.we ?? WEATHERS)];
  const axes: Axes = { se, we: weatherAxis, ti };
  const nightAxes: Axes = { se, we: weatherAxis, ti: inter(ti, ['dusk', 'evening', 'night']) };

  if (typeof input.place === 'string') out.push(...neutralityProblems(`[${id}] place`, input.place, axes, tags));

  // Свет
  out.push(...formatProblems(`[${id}] light`, input.light, 8, 150));
  if (typeof input.light === 'string') out.push(...neutralityProblems(`[${id}] light`, input.light, axes, tags));
  if (input.night !== undefined) {
    out.push(...formatProblems(`[${id}] night`, input.night, 8, 150));
    if (typeof input.night === 'string') out.push(...neutralityProblems(`[${id}] night`, input.night, nightAxes, tags));
  }

  // Действия
  const acts = input.act ?? [];
  if (acts.length < 3 || acts.length > 6) add(`act: 3–6 действий, сейчас ${acts.length}`);
  let hasBackAction = false;
  acts.forEach((a, i) => {
    const lab = `[${id}] act[${i}]`;
    if (!Array.isArray(a) || a.length < 4) {
      out.push(`${lab}: кортеж [en, ru, posture, hands, flags?]`);
      return;
    }
    const [en, ru, posture, hands, flags] = a as readonly [string, string, string, number, string | undefined];
    out.push(...formatProblems(`${lab}.en`, en, 14, 120));
    if (typeof en === 'string') {
      if (!ING_RE.test(en)) out.push(`${lab}.en: причастие на -ing без подлежащего («pouring…», «leaning…»)`);
      out.push(...neutralityProblems(`${lab}.en`, en, axes, tags));
    }
    if (typeof ru !== 'string' || !CYRILLIC_RE.test(ru) || ru.length < 6 || ru.length > 110) out.push(`${lab}.ru: русская фраза 6–110 символов`);
    if (!(POSTURES as readonly string[]).includes(posture)) out.push(`${lab}: posture ∈ ${POSTURES.join('|')}`);
    if (![0, 1, 2].includes(hands)) out.push(`${lab}: hands ∈ 0|1|2`);
    const f = (flags ?? '').split(/\s+/).filter(Boolean);
    if (f.some((x) => !['back', 'hidden', 'obj'].includes(x))) out.push(`${lab}: flags только back | hidden | obj`);
    if (f.includes('back')) hasBackAction = true;
  });
  if (acts.filter((a) => Array.isArray(a) && isSelfieFriendly({ posture: a[2], hands: a[3], back: (a[4] ?? '').includes('back'), hidden: (a[4] ?? '').includes('hidden'), obj: (a[4] ?? '').includes('obj') })).length === acts.length && acts.length > 0) {
    add('act: добавьте хотя бы одно действие, не подходящее для селфи (hands 2, obj, back или hidden) — нужны кадры «чужой рукой»');
  }
  const enSet = new Set(acts.map((a) => a[0]));
  if (enSet.size !== acts.length) add('act: повторяющиеся действия внутри сцены');

  // Одежда
  const outf = input.out ?? [];
  if (!outf.length || outf.length > 5 || outf.some((t) => !(OUTFIT_TAGS as readonly string[]).includes(t))) {
    add(`out: 1–5 тегов из ${OUTFIT_TAGS.join(', ')}`);
  }

  // Фон
  for (const [key, list] of [
    ['fg', input.fg],
    ['mid', input.mid],
    ['far', input.far],
  ] as const) {
    if (!Array.isArray(list) || list.length < 2 || list.length > 4) {
      add(`${key}: 2–4 существительные фразы`);
      continue;
    }
    list.forEach((t, i) => {
      out.push(...formatProblems(`[${id}] ${key}[${i}]`, t, 8, 110));
      if (typeof t === 'string') out.push(...neutralityProblems(`[${id}] ${key}[${i}]`, t, axes, tags));
    });
    if (new Set(list).size !== list.length) add(`${key}: повторы`);
  }

  // Детали
  const dets = input.det ?? [];
  if (dets.length < 3 || dets.length > 6) add(`det: 3–6 деталей, сейчас ${dets.length}`);
  let unconditional = 0;
  let scene: Scene | null = null;
  try {
    scene = normalizeScene(input);
  } catch (e) {
    add(`normalize: ${(e as Error).message}`);
  }
  const all = scene ? CLIMATES.flatMap((c) => sceneTriples(scene as Scene, c)) : [];
  dets.forEach((d, i) => {
    const lab = `[${id}] det[${i}]`;
    const text = typeof d === 'string' ? d : d?.[0];
    out.push(...formatProblems(lab, text, 10, 120));
    if (typeof d === 'string') {
      unconditional += 1;
      out.push(...neutralityProblems(lab, d, axes, tags));
      return;
    }
    if (!Array.isArray(d) || d.length !== 2) {
      out.push(`${lab}: строка или [текст, условие]`);
      return;
    }
    let w;
    try {
      w = parseWhen(d[1]);
    } catch (e) {
      out.push(`${lab}: ${(e as Error).message}`);
      return;
    }
    if (input.view === 'none' && input.dress !== 'out' && w.weathers) out.push(`${lab}: условия по погоде бессмысленны в сцене без вида наружу`);
    const eff: Axes = {
      se: w.seasons ? inter(w.seasons, se) : se,
      we: w.weathers ? inter(w.weathers, weatherAxis) : weatherAxis,
      ti: w.times ? inter(w.times, ti) : ti,
    };
    if (!eff.se.length || !eff.we.length || !eff.ti.length) {
      out.push(`${lab}: условие «${d[1]}» не пересекается с сезонами/погодой/временем сцены`);
      return;
    }
    if (scene) {
      const reach = all.some(
        (tr) =>
          (!w.seasons || w.seasons.includes(tr.season)) &&
          (!w.weathers || (tr.weather !== null && w.weathers.includes(tr.weather))) &&
          (!w.times || w.times.includes(tr.time)),
      );
      if (!reach) out.push(`${lab}: условие «${d[1]}» недостижимо ни в одном климате`);
    }
    out.push(...neutralityProblems(lab, d[0], eff, tags));
  });
  if (dets.length >= 3 && unconditional < 2) add('det: минимум две безусловные детали');

  // Ракурсы
  const ang = input.ang ?? [];
  if (ang.length < 3 || ang.length > 8 || new Set(ang).size !== ang.length || ang.some((a) => !(ANGLES as readonly string[]).includes(a))) {
    add(`ang: 3–8 уникальных ракурсов из ${ANGLES.join(', ')}`);
  } else if (!ang.some((a) => a === 'front' || a === 'three-quarter' || a === 'eye-level')) {
    add('ang: нужен хотя бы один из front / three-quarter / eye-level');
  }
  if (hasBackAction && !ang.some((a) => ['back-head-turn', 'side', 'profile', 'distant', 'face-limited'].includes(a))) {
    add('ang: для действия с флагом back нужен ракурс back-head-turn, side, profile, distant или face-limited');
  }
  if (input.crowd !== undefined && ![0, 1, 2].includes(input.crowd)) add('crowd: 0 | 1 | 2');

  // Достижимость
  if (scene) {
    if (all.length === 0) add('нет ни одного допустимого сочетания сезон × погода × время');
    for (const s of se) if (!all.some((t) => t.season === s)) add(`сезон «${s}» недостижим: нет совместимой погоды/времени`);
    for (const t of ti) if (!all.some((x) => x.time === t)) add(`время «${t}» недостижимо при заданных сезонах/погоде`);
    if (scene.weatherMode === 'visible') {
      for (const w of scene.weathers) if (!all.some((x) => x.weather === w)) add(`погода «${w}» недостижима при заданных сезонах/времени`);
    }
  }
  return out;
}

/** Проверки библиотеки целиком. */
export function validateLibrary(inputs: readonly SceneInput[], opts: { min: number }): string[] {
  const p: string[] = [];
  if (inputs.length < opts.min) p.push(`сцен ${inputs.length}, требуется не менее ${opts.min}`);
  const dup = (label: string, values: string[]) => {
    const seen = new Set<string>();
    for (const v of values) {
      if (seen.has(v)) p.push(`${label}: повтор «${v}»`);
      seen.add(v);
    }
  };
  dup('id', inputs.map((s) => s.id));
  dup('ru', inputs.map((s) => s.ru.trim().toLowerCase()));
  dup('place', inputs.map((s) => s.place.trim().toLowerCase()));

  const n = inputs.length || 1;
  const share = (pred: (s: SceneInput) => boolean) => inputs.filter(pred).length / n;
  if (share((s) => s.rar === 'c') < 0.4) p.push('доля common < 40 %');
  if (share((s) => s.rar === 'u') < 0.2) p.push('доля uncommon < 20 %');
  if (share((s) => s.rar === 'r') < 0.08) p.push('доля rare < 8 %');
  if (share((s) => s.env === 'in') < 0.25) p.push('помещений < 25 %');
  if (share((s) => s.env !== 'in') < 0.4) p.push('открытых/полуоткрытых мест < 40 %');
  if (inputs.filter((s) => s.mirror).length < 12) p.push('сцен с зеркалом (mirror) меньше 12');
  if (inputs.filter((s) => s.glass).length < 12) p.push('сцен со стеклом/витриной (glass) меньше 12');
  const selfieShare = share((s) => s.act.some((a) => isSelfieFriendly({ posture: a[2], hands: a[3], back: (a[4] ?? '').includes('back'), hidden: (a[4] ?? '').includes('hidden'), obj: (a[4] ?? '').includes('obj') })));
  if (selfieShare < 0.75) p.push(`сцен с подходящим для селфи действием ${(selfieShare * 100).toFixed(0)} % (< 75 %)`);
  for (const s of SEASONS) if (inputs.filter((x) => x.se.includes(s)).length < 100) p.push(`сезон ${s}: меньше 100 сцен`);
  for (const t of TIMES) if (inputs.filter((x) => x.ti.includes(t)).length < (t === 'dawn' ? 40 : 70)) p.push(`время ${t}: слишком мало сцен`);
  for (const c of CATEGORIES) if (inputs.filter((x) => x.cat === c).length < 20) p.push(`категория ${c}: меньше 20 сцен`);
  const acts = inputs.flatMap((s) => s.act.map((a) => a[0]));
  const dupActs = acts.length - new Set(acts).size;
  if (dupActs > acts.length * 0.03) p.push(`слишком много повторяющихся действий между сценами: ${dupActs}`);
  return p;
}
