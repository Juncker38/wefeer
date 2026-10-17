import { useMemo, useState } from 'react';
import { ratioFromId } from '../core/settings.ts';
import type { RatioId } from '../core/vocab.ts';
import { L_ANGLE, L_CAPTURE, L_CATEGORY, L_EMOTION, L_FRAMING, L_RARITY, L_SEASON, L_TIME, L_WEATHER } from '../core/labels.ts';
import type { PhotoScenario } from '../core/types.ts';
import type { LockKey } from '../core/vocab.ts';
import { ALL_SCENES } from '../data/scenes/index.ts';
import { REROLL_LABELS, blockingLocks } from '../engine/generate.ts';
import type { RerollAspect } from '../engine/generate.ts';
import { EDIT_ASPECTS, editOptions } from '../engine/options.ts';
import type { EditAspect } from '../engine/options.ts';
import { useIsWide } from './hooks.ts';
import { useStudio } from './store.tsx';
import { Button, Chip, Dialog, IconButton, Select, TabPanel, Tabs } from './ui.tsx';

const SUBJECT_LOCKS: LockKey[] = ['age', 'hair', 'eyes', 'skin', 'build', 'face'];

interface Row {
  aspect: RerollAspect;
  label: string;
  lock?: LockKey | 'subject';
  value: (s: PhotoScenario) => string;
}

const ROWS: Row[] = [
  { aspect: 'scene', label: 'Локация', lock: 'scene', value: (s) => `${s.sceneTitle} · ${L_CATEGORY[s.category]} · ${L_RARITY[s.rarity].toLowerCase()}` },
  { aspect: 'action', label: 'Поза / действие', lock: 'action', value: (s) => s.action.ru },
  { aspect: 'season', label: 'Сезон', lock: 'season', value: (s) => L_SEASON[s.season] },
  { aspect: 'weather', label: 'Погода', lock: 'weather', value: (s) => (s.weather === null ? 'не отображается (помещение без окон)' : L_WEATHER[s.weather]) },
  { aspect: 'time', label: 'Время суток', lock: 'time', value: (s) => L_TIME[s.time] },
  { aspect: 'capture', label: 'Тип съёмки', lock: 'capture', value: (s) => L_CAPTURE[s.capture] },
  { aspect: 'framing', label: 'Кадрирование', lock: 'framing', value: (s) => L_FRAMING[s.framing] },
  { aspect: 'angle', label: 'Ракурс', lock: 'angle', value: (s) => L_ANGLE[s.angle] },
  { aspect: 'emotion', label: 'Эмоция', lock: 'emotion', value: (s) => L_EMOTION[s.emotion] },
  { aspect: 'outfit', label: 'Одежда', lock: 'outfit', value: (s) => s.outfit.ru },
  { aspect: 'subject', label: 'Внешность', lock: 'subject', value: (s) => `${s.subject.age} лет` },
  { aspect: 'details', label: 'Детали и фон', value: (s) => `${s.details.length} дет., ${s.fg.length + s.mid.length + s.far.length} предм. фона` },
  { aspect: 'ratio', label: 'Формат', lock: 'ratio', value: (s) => `${s.ratio.label}, ${s.ratio.orientation === 'vertical' ? 'вертикально' : s.ratio.orientation === 'horizontal' ? 'горизонтально' : 'квадрат'}` },
];

function AspectGrid({ onEdit }: { onEdit: () => void }) {
  const { current, settings, reroll, toggleLock, setSettings } = useStudio();
  if (!current) return null;
  const s = current.scenario;
  const subjectAll = SUBJECT_LOCKS.every((k) => settings.locks.includes(k));
  const toggleSubject = () =>
    setSettings((st) => ({ ...st, locks: subjectAll ? st.locks.filter((k) => !SUBJECT_LOCKS.includes(k)) : [...new Set([...st.locks, ...SUBJECT_LOCKS])] }));
  return (
    <section className="aspects" aria-labelledby="aspects-title">
      <div className="aspects-head">
        <h3 id="aspects-title">Параметры кадра</h3>
        <Button small icon="edit" onClick={onEdit}>
          Править сценарий
        </Button>
      </div>
      <p className="hint">Сменить можно один аспект — остальное сохранится, а совместимость пересчитается. 🔒 закрепляет значение для следующих генераций.</p>
      <ul className="aspect-list">
        {ROWS.map((r) => {
          const blocked = blockingLocks(settings, r.aspect);
          const locked = r.lock === 'subject' ? subjectAll : r.lock ? settings.locks.includes(r.lock) : false;
          const disabled = blocked.length > 0 || (r.aspect === 'weather' && s.weather === null);
          return (
            <li key={r.aspect} className="aspect">
              <span className="aspect-label">{r.label}</span>
              <span className="aspect-value">{r.value(s)}</span>
              <span className="aspect-actions">
                <IconButton icon="dice" label={`${REROLL_LABELS[r.aspect]}${disabled ? ' (недоступно: параметр закреплён)' : ''}`} disabled={disabled} onClick={() => reroll(r.aspect)} />
                {r.lock ? <IconButton icon={locked ? 'lock' : 'unlock'} label={`${locked ? 'Снять закрепление' : 'Закрепить'}: ${r.label.toLowerCase()}`} pressed={locked} onClick={() => (r.lock === 'subject' ? toggleSubject() : toggleLock(r.lock as LockKey))} /> : <span className="aspect-spacer" />}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ScenarioEditor({ onClose }: { onClose: () => void }) {
  const { current, settings, edit } = useStudio();
  const [draft, setDraft] = useState<Partial<Record<EditAspect, string>>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const opts = useMemo(() => {
    if (!current) return null;
    const out = {} as Record<EditAspect, ReturnType<typeof editOptions>>;
    for (const a of EDIT_ASPECTS) out[a] = a === 'scene' ? [] : editOptions(settings, current.scenario, a);
    return out;
  }, [current, settings]);
  const [sceneOpts, setSceneOpts] = useState<ReturnType<typeof editOptions> | null>(null);
  if (!current || !opts) return null;
  const s = current.scenario;
  const curVal: Record<EditAspect, string> = { scene: s.sceneId, action: s.action.id, season: s.season, weather: s.weather ?? '', time: s.time, capture: s.capture, framing: s.framing, angle: s.angle, emotion: s.emotion, outfit: s.outfit.id, ratio: s.ratio.label };
  const labels: Record<EditAspect, string> = { scene: 'Локация', action: 'Поза / действие', season: 'Сезон', weather: 'Погода', time: 'Время суток', capture: 'Тип съёмки', framing: 'Кадрирование', angle: 'Ракурс', emotion: 'Эмоция', outfit: 'Одежда', ratio: 'Формат' };
  const loadScenes = () => {
    if (!sceneOpts) setSceneOpts(editOptions(settings, s, 'scene'));
  };
  const list = (a: EditAspect) => (a === 'scene' ? (sceneOpts ?? ALL_SCENES.map((x) => ({ value: x.id, label: x.titleRu, ok: true }))) : opts[a]);
  const apply = () => {
    const patch: Record<string, unknown> = {};
    for (const a of EDIT_ASPECTS) {
      const v = draft[a];
      if (v === undefined || v === curVal[a]) continue;
      if (a === 'scene') patch.sceneId = v;
      else if (a === 'action') patch.actionId = v;
      else if (a === 'outfit') patch.outfitId = v;
      else if (a === 'ratio') patch.ratio = ratioFromId(v as RatioId);
      else patch[a] = v;
    }
    if (!Object.keys(patch).length) {
      setMsg('Ничего не изменено.');
      return;
    }
    const r = edit(patch);
    if (r.ok) onClose();
    else setMsg(r.reason);
  };
  return (
    <Dialog
      title="Редактирование сценария"
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="primary" icon="check" onClick={apply}>
            Применить
          </Button>
          <Button onClick={onClose}>Отмена</Button>
        </>
      }
    >
      <p className="hint">Недоступные варианты отмечены причиной. После правки остальные параметры подстраиваются, а совместимость проверяется заново.</p>
      <div className="editor-grid">
        {EDIT_ASPECTS.filter((a) => !(a === 'weather' && s.weather === null)).map((a) => (
          <div key={a} onFocusCapture={a === 'scene' ? loadScenes : undefined}>
            <Select
              label={labels[a]}
              value={draft[a] ?? curVal[a]}
              options={list(a).map((o) => ({ value: o.value, label: o.ok ? o.label : `${o.label} — недоступно: ${o.reason ?? 'несовместимо'}`, disabled: !o.ok && o.value !== curVal[a] }))}
              onChange={(v) => setDraft((d) => ({ ...d, [a]: v }))}
            />
          </div>
        ))}
      </div>
      {msg ? (
        <p className="err" role="alert">
          {msg}
        </p>
      ) : null}
    </Dialog>
  );
}

function ActionBar() {
  const { generate, generateMore, repeat, randomizeAll, copy, toggleFavoriteCurrent, resetSettings, current, history } = useStudio();
  const wide = useIsWide();
  const fav = !!current?.entryId && !!history.find((h) => h.id === current.entryId)?.favorite;
  return (
    <div className="actionbar" role="toolbar" aria-label="Действия">
      <div className="ab-row">
        <Button variant="primary" icon="sparkles" className="ab-main" onClick={generate} title="Ctrl + Enter">
          Сгенерировать
        </Button>
        <Button icon="plus" className="ab-compact" onClick={generateMore} aria-label="Сгенерировать ещё" title="Сгенерировать ещё">
          Сгенерировать ещё
        </Button>
        <Button icon="copy" className="ab-compact" onClick={() => void copy('main')} disabled={!current} aria-label="Копировать" title="Копировать основной промпт">
          Копировать
        </Button>
        <Button icon="star" className={`ab-compact${fav ? ' is-on' : ''}`} onClick={toggleFavoriteCurrent} disabled={!current} aria-pressed={fav} aria-label={fav ? 'Сохранено в избранное' : 'Сохранить в избранное'} title="Сохранить в избранное">
          {fav ? 'Сохранено' : 'Сохранить'}
        </Button>
      </div>
      <details className="ab-more" open={wide}>
        <summary>Ещё действия</summary>
        <div className="ab-row">
          <Button icon="repeat" onClick={repeat} disabled={!current} title="Тот же seed и те же настройки">
            Повторить с теми же настройками
          </Button>
          <Button icon="dice" onClick={randomizeAll}>
            Случайно всё
          </Button>
          <Button icon="refresh" variant="ghost" onClick={() => void resetSettings()}>
            Сбросить
          </Button>
        </div>
      </details>
    </div>
  );
}

type OutTab = 'prompt' | 'negative' | 'json' | 'meta' | 'ru';

function Output() {
  const { rendered, settings, copy, download, current } = useStudio();
  const [tab, setTab] = useState<OutTab>('prompt');
  if (!rendered || !current) return null;
  const inline = settings.profile !== 'universal';
  const tabs: { id: OutTab; label: string }[] = [
    { id: 'prompt', label: 'Промпт' },
    { id: 'negative', label: 'Negative' },
    { id: 'json', label: 'JSON' },
    { id: 'meta', label: 'Метаданные' },
    ...(settings.showRussian ? [{ id: 'ru' as const, label: 'По-русски' }] : []),
  ];
  const active = tabs.some((t) => t.id === tab) ? tab : 'prompt';
  return (
    <div className="output">
      <Tabs label="Формат результата" idPrefix="out" tabs={tabs} value={active} onChange={setTab} />
      <TabPanel idPrefix="out" id="prompt" active={active === 'prompt'}>
        <pre className="prompt-text" tabIndex={0} aria-label="Основной промпт">
          {rendered.main}
        </pre>
        <div className="btn-row">
          <Button small icon="copy" onClick={() => void copy('main')}>
            Копировать основной
          </Button>
          {!inline ? (
            <Button small icon="copy" onClick={() => void copy('main+negative')}>
              Копировать основной + negative
            </Button>
          ) : null}
          <Button small icon="download" onClick={() => download('txt')}>
            Скачать TXT
          </Button>
          <span className="muted">{rendered.words} слов · профиль «{settings.profile}»</span>
        </div>
        {inline && settings.includeNegative ? <p className="hint">В этом профиле «чего избегать» добавлено в конец текста; отдельный список — на вкладке Negative.</p> : null}
      </TabPanel>
      <TabPanel idPrefix="out" id="negative" active={active === 'negative'}>
        <pre className="prompt-text" tabIndex={0} aria-label="Negative prompt">
          {rendered.negative}
        </pre>
        <div className="btn-row">
          <Button small icon="copy" onClick={() => void copy('negative')}>
            Копировать negative
          </Button>
        </div>
        <p className="hint">Синтаксис негативных подсказок зависит от инструмента — список дан простым текстом, без специальных параметров.</p>
      </TabPanel>
      <TabPanel idPrefix="out" id="json" active={active === 'json'}>
        <pre className="prompt-text prompt-json" tabIndex={0} aria-label="JSON сценария">
          {rendered.json}
        </pre>
        <div className="btn-row">
          <Button small icon="copy" onClick={() => void copy('json')}>
            Копировать JSON
          </Button>
          <Button small icon="download" onClick={() => download('json')}>
            Скачать JSON
          </Button>
        </div>
      </TabPanel>
      <TabPanel idPrefix="out" id="meta" active={active === 'meta'}>
        <dl className="meta">
          {rendered.metadata.map((m) => (
            <div key={m.key} className="meta-row">
              <dt>{m.key}</dt>
              <dd>{m.value}</dd>
            </div>
          ))}
        </dl>
      </TabPanel>
      <TabPanel idPrefix="out" id="ru" active={active === 'ru'}>
        <pre className="prompt-text" tabIndex={0} aria-label="Описание по-русски">
          {rendered.ru}
        </pre>
        <div className="btn-row">
          <Button small icon="copy" onClick={() => void copy('ru')}>
            Копировать
          </Button>
        </div>
        <p className="hint">Это краткий пересказ параметров, а не дословный перевод: микродетали фона даны только в английском тексте.</p>
      </TabPanel>
    </div>
  );
}

function Chips({ s }: { s: PhotoScenario }) {
  const items = [`${s.subject.age} лет`, s.sceneTitle, L_SEASON[s.season], s.weather ? L_WEATHER[s.weather] : null, L_TIME[s.time], L_CAPTURE[s.capture], L_FRAMING[s.framing], L_ANGLE[s.angle], L_EMOTION[s.emotion], s.ratio.label].filter((x): x is string => !!x);
  return (
    <ul className="facts" aria-label="Ключевые характеристики">
      {items.map((t, i) => (
        <li key={`${t}-${i}`} className="fact">
          {t}
        </li>
      ))}
    </ul>
  );
}

export function ResultPanel() {
  const { current, error, series, selectSeriesFrame, settings, feasible, report } = useStudio();
  const [editing, setEditing] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const warn = current?.diversity?.tooStrict ? current.diversity.message : null;
  const why = showWhy ? report() : null;
  return (
    <section className="result" aria-labelledby="result-title">
      <header className="result-head">
        <h2 id="result-title">Результат</h2>
        <button type="button" className="link" onClick={() => setShowWhy((v) => !v)} aria-expanded={showWhy}>
          Подходит локаций: {feasible} — почему так?
        </button>
      </header>
      {why ? (
        <div className="callout" role="status">
          <p>
            Доступно локаций: <strong>{why.feasibleScenes}</strong> из {why.totalScenes}. Абсолютная уникальность не гарантируется: чем больше ограничений и закреплений, тем чаще повторы.
          </p>
          {why.families.length ? (
            <ul className="plain">
              {why.families.slice(0, 5).map((f) => (
                <li key={f.id}>
                  «{f.title}»: если снять, станет {f.scenes} (+{f.gain})
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Ручные ограничения почти не сужают выбор.</p>
          )}
          {why.messages.map((m) => (
            <p key={m} className="hint">
              {m}
            </p>
          ))}
        </div>
      ) : null}
      <ActionBar />
      {error ? (
        <div className="callout callout-error" role="alert">
          <p>
            <strong>{error.reason}</strong>
          </p>
          <ul className="plain">
            {error.hints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {!current && !error ? (
        <div className="empty">
          <h3>Готов к работе</h3>
          <p>Настройки по умолчанию уже дают полезный результат: нажмите «Сгенерировать» (Ctrl + Enter). Промпт появится здесь вместе с negative prompt, метаданными и JSON.</p>
          <p className="muted">Режим: {settings.mode === 'chaos' ? 'полный рандом' : settings.mode === 'series' ? 'серия кадров' : settings.mode === 'character' ? 'один персонаж' : 'новая девушка'}. Всё считается локально, без сети.</p>
        </div>
      ) : null}
      {series ? (
        <nav className="series" aria-label={`Серия: ${series.title}`}>
          <span className="muted">Серия «{series.title}»:</span>
          {series.frames.map((f, i) => (
            <Chip key={f.entryId} pressed={i === series.index} onClick={() => selectSeriesFrame(i)} aria-label={`Кадр ${i + 1}: ${f.scenario.sceneTitle}`}>
              {i + 1}
            </Chip>
          ))}
        </nav>
      ) : null}
      {current ? (
        <>
          <Chips s={current.scenario} />
          {warn ? (
            <div className="callout callout-warn" role="status">
              {warn}
            </div>
          ) : null}
          {current.scenario.notes.filter((n) => !n.startsWith('Не удалось подобрать')).length ? (
            <ul className="notes" aria-label="Примечания">
              {current.scenario.notes
                .filter((n) => !n.startsWith('Не удалось подобрать'))
                .map((n) => (
                  <li key={n}>{n}</li>
                ))}
            </ul>
          ) : null}
          <Output />
          <AspectGrid onEdit={() => setEditing(true)} />
          {editing ? <ScenarioEditor onClose={() => setEditing(false)} /> : null}
        </>
      ) : null}
    </section>
  );
}
