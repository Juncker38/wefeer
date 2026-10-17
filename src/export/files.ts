import type { HistoryEntry } from '../storage/history.ts';

// ───────── Форматы выгрузки ─────────

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Безопасное имя файла: только латиница, цифры, дефис и подчёркивание. */
export function safeFilename(name: string, ext: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);
  return `${base || 'realphoto'}.${ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'txt'}`;
}

export function singleFilename(e: HistoryEntry, ext: 'txt' | 'json', now: Date = new Date(e.createdAt)): string {
  return safeFilename(`realphoto-${e.profile}-${stamp(now)}-${e.scenario.seed}`, ext);
}

export function batchFilename(count: number, ext: 'csv' | 'json' | 'txt', now: Date = new Date()): string {
  return safeFilename(`realphoto-batch-${count}-${stamp(now)}`, ext);
}

export function entryToTxt(e: HistoryEntry, withNegative: boolean = e.includeNegative): string {
  const s = e.scenario;
  const lines = [e.main.trim()];
  if (withNegative && e.profile !== 'gpt-image' && e.profile !== 'nano-banana' && e.profile !== 'seedance') lines.push('', `Negative prompt: ${e.negative}`);
  lines.push('', `Seed: ${s.seed}`, `Scenario: ${s.id}`, `Aspect ratio: ${s.ratio.label}`, `Profile: ${e.profile} (text formatting only)`);
  return `${lines.join('\n')}\n`;
}

export function entriesToTxt(entries: readonly HistoryEntry[], withNegative = true): string {
  return entries.map((e, i) => `#${i + 1}\n${entryToTxt(e, withNegative)}`).join('\n---\n\n');
}

function plain(e: HistoryEntry) {
  const s = e.scenario;
  return {
    id: e.id,
    createdAt: new Date(e.createdAt).toISOString(),
    favorite: e.favorite,
    seed: s.seed,
    scenarioId: s.id,
    mode: s.mode,
    aspectRatio: s.ratio.label,
    profile: e.profile,
    length: e.length,
    mainPrompt: e.main,
    negativePrompt: e.negative,
    scenario: s,
    settings: e.settings,
  };
}

export function entriesToJson(entries: readonly HistoryEntry[]): string {
  return JSON.stringify({ app: 'RealPhoto Prompt Studio', count: entries.length, items: entries.map(plain) }, null, 2);
}

export function entryToJson(e: HistoryEntry): string {
  return JSON.stringify({ app: 'RealPhoto Prompt Studio', ...plain(e) }, null, 2);
}

/** Ячейка CSV по RFC 4180; значения, похожие на формулы, нейтрализуются. */
export function csvCell(value: string | number | boolean): string {
  let v = String(value);
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export const CSV_COLUMNS = [
  'index',
  'created_at',
  'seed',
  'scenario_id',
  'mode',
  'aspect_ratio',
  'age',
  'category',
  'scene',
  'season',
  'weather',
  'time',
  'capture',
  'framing',
  'angle',
  'emotion',
  'profile',
  'main_prompt',
  'negative_prompt',
] as const;

export function entriesToCsv(entries: readonly HistoryEntry[]): string {
  const rows = entries.map((e, i) => {
    const s = e.scenario;
    return [
      i + 1,
      new Date(e.createdAt).toISOString(),
      s.seed,
      s.id,
      s.mode,
      s.ratio.label,
      s.subject.age,
      s.category,
      s.sceneId,
      s.season,
      s.weather ?? '',
      s.time,
      s.capture,
      s.framing,
      s.angle,
      s.emotion,
      e.profile,
      e.main,
      e.negative,
    ]
      .map(csvCell)
      .join(',');
  });
  // BOM — чтобы Excel корректно открыл UTF-8; перевод строки CRLF по RFC 4180.
  return `\uFEFF${[CSV_COLUMNS.join(','), ...rows].join('\r\n')}\r\n`;
}
