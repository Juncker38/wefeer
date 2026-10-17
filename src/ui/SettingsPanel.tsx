import { useMemo, useState } from 'react';
import { CHOICE_HELP, CHOICE_LABELS, CHOICE_TITLES, L_BALANCE, L_CAPTURE, L_CATEGORY, L_CLIMATE, L_COLOR, L_DETAIL, L_LENGTH, L_LOCK, L_MODE, L_PROFILE, L_RARITY, L_SERIES_THEME, L_SHARPNESS, L_STYLE, MODE_HELP, PROFILE_HELP } from '../core/labels.ts';
import { CHOICE_OPTIONS, DEFAULT_CAPTURE_SHARES, isValidCustomRatio } from '../core/settings.ts';
import type { ChoiceKey, FieldMode, Settings } from '../core/settings.ts';
import { BALANCES, CAPTURES, CLIMATES, COLORS, DETAIL_LEVELS, LENGTHS, LOCK_KEYS, MODES, PROFILES, RARITIES, RATIO_IDS, SERIES_THEMES, SHARPNESS, STYLES } from '../core/vocab.ts';
import type { LockKey } from '../core/vocab.ts';
import { ALL_SCENES } from '../data/scenes/index.ts';
import { makeSeed } from '../engine/rng.ts';
import { useStudio } from './store.tsx';
import { Button, Chip, Field, NumberField, Section, Select, Slider, TabPanel, Tabs, Toggle } from './ui.tsx';
import { useIsWide } from './hooks.ts';

const CHOICE_LOCK: Partial<Record<ChoiceKey, LockKey>> = {
  hairColor: 'hair',
  hairLength: 'hair',
  hairType: 'hair',
  hairStyle: 'hair',
  eyeColor: 'eyes',
  skinTone: 'skin',
  build: 'build',
  height: 'build',
  makeup: 'face',
  freckles: 'face',
  glasses: 'face',
  clothingStyle: 'outfit',
  scene: 'scene',
  season: 'season',
  weather: 'weather',
  time: 'time',
  framing: 'framing',
  angle: 'angle',
  emotion: 'emotion',
  posture: 'action',
};

const MODE_LABEL: Record<FieldMode, string> = { auto: 'Авто / случайно', manual: 'Выбрать', exclude: 'Исключить' };

function ChoiceField({ k, options }: { k: Exclude<ChoiceKey, 'scene'>; options?: readonly string[] }) {
  const { settings, setSettings, current } = useStudio();
  const ctl = settings.choices[k];
  const labels = CHOICE_LABELS[k];
  const opts = options ?? CHOICE_OPTIONS[k];
  const lock = CHOICE_LOCK[k];
  const locked = !!lock && settings.locks.includes(lock) && !!current;
  const setMode = (mode: FieldMode) => setSettings((s) => ({ ...s, choices: { ...s.choices, [k]: { mode, values: mode === 'auto' ? [] : s.choices[k].values } } }));
  const toggle = (v: string) =>
    setSettings((s) => {
      const cur = s.choices[k];
      const values = cur.values.includes(v) ? cur.values.filter((x) => x !== v) : [...cur.values, v];
      return { ...s, choices: { ...s.choices, [k]: { mode: cur.mode === 'auto' ? 'manual' : cur.mode, values } } };
    });
  return (
    <fieldset className="choice">
      <legend>
        {CHOICE_TITLES[k]}
        {locked ? <span className="lock-note"> · закреплено значением из кадра</span> : null}
      </legend>
      <div className="segmented" role="group" aria-label={`${CHOICE_TITLES[k]}: режим`}>
        {(['auto', 'manual', 'exclude'] as const).map((m) => (
          <Chip key={m} pressed={ctl.mode === m} onClick={() => setMode(m)}>
            {MODE_LABEL[m]}
          </Chip>
        ))}
      </div>
      {ctl.mode !== 'auto' ? (
        <div className="chips" role="group" aria-label={`${CHOICE_TITLES[k]}: значения`}>
          {opts.map((v) => (
            <Chip key={v} pressed={ctl.values.includes(v)} onClick={() => toggle(v)}>
              {labels[v]}
            </Chip>
          ))}
        </div>
      ) : null}
      {ctl.mode !== 'auto' && ctl.values.length === 0 ? <p className="hint">Отметьте значения — пока ничего не выбрано, действует «Авто».</p> : null}
      {CHOICE_HELP[k] ? <p className="hint">{CHOICE_HELP[k]}</p> : null}
    </fieldset>
  );
}

function SceneField() {
  const { settings, setSettings } = useStudio();
  const ctl = settings.choices.scene;
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return ALL_SCENES.filter((s) => !t || s.titleRu.toLowerCase().includes(t) || s.place.toLowerCase().includes(t) || L_CATEGORY[s.category].toLowerCase().includes(t)).slice(0, 60);
  }, [q]);
  const setMode = (mode: FieldMode) => setSettings((s) => ({ ...s, choices: { ...s.choices, scene: { mode, values: mode === 'auto' ? [] : s.choices.scene.values } } }));
  const toggle = (id: string) =>
    setSettings((s) => {
      const cur = s.choices.scene;
      const values = cur.values.includes(id) ? cur.values.filter((x) => x !== id) : [...cur.values, id];
      return { ...s, choices: { ...s.choices, scene: { mode: cur.mode === 'auto' ? 'manual' : cur.mode, values } } };
    });
  return (
    <fieldset className="choice">
      <legend>Конкретные локации ({ALL_SCENES.length} в библиотеке)</legend>
      <div className="segmented" role="group" aria-label="Конкретные локации: режим">
        {(['auto', 'manual', 'exclude'] as const).map((m) => (
          <Chip key={m} pressed={ctl.mode === m} onClick={() => setMode(m)}>
            {MODE_LABEL[m]}
          </Chip>
        ))}
      </div>
      {ctl.mode !== 'auto' ? (
        <>
          <Field label="Поиск по названию, месту или категории" id="scene-search">
            <input id="scene-search" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="например: кухня, мост, бассейн" />
          </Field>
          <p className="hint">
            Выбрано: {ctl.values.length}
            {ctl.values.length ? (
              <>
                {' · '}
                <button type="button" className="link" onClick={() => setSettings((s) => ({ ...s, choices: { ...s.choices, scene: { mode: s.choices.scene.mode, values: [] } } }))}>
                  снять все
                </button>
              </>
            ) : null}
          </p>
          <ul className="scene-list" aria-label="Список локаций">
            {list.map((s) => (
              <li key={s.id}>
                <label className="check">
                  <input type="checkbox" checked={ctl.values.includes(s.id)} onChange={() => toggle(s.id)} />
                  <span>
                    {s.titleRu} <em className="muted">· {L_CATEGORY[s.category]}</em>
                  </span>
                </label>
              </li>
            ))}
            {list.length === 0 ? <li className="muted">Ничего не найдено.</li> : null}
          </ul>
        </>
      ) : null}
    </fieldset>
  );
}

function AgeField() {
  const { settings, setSettings } = useStudio();
  const a = settings.age;
  const exact = a.exact !== null;
  const bad = !exact && a.min > a.max ? 'Минимум не может быть больше максимума.' : null;
  return (
    <div className="stack">
      <Toggle checked={exact} onChange={(v) => setSettings((s) => ({ ...s, age: { ...s.age, exact: v ? Math.round((s.age.min + s.age.max) / 2) : null } }))} label="Точный возраст" hint="Всегда от 20 до 45 лет и всегда явно указывается в промпте. Без точного значения возраст выбирается с пиком вероятности 25–33, остальные не исключены." />
      {exact ? (
        <NumberField label="Возраст" value={a.exact ?? 28} min={20} max={45} onChange={(v) => setSettings((s) => ({ ...s, age: { ...s.age, exact: v } }))} />
      ) : (
        <div className="row2">
          <NumberField label="От" value={a.min} min={20} max={45} error={bad} onChange={(v) => setSettings((s) => ({ ...s, age: { ...s.age, min: v } }))} />
          <NumberField label="До" value={a.max} min={20} max={45} onChange={(v) => setSettings((s) => ({ ...s, age: { ...s.age, max: v } }))} />
        </div>
      )}
    </div>
  );
}

function SeedField() {
  const { settings, setSettings, current, pinSeed, toast } = useStudio();
  return (
    <Field label="Seed (воспроизводимость)" id="seed" hint="Пусто — новый случайный seed при каждой генерации. Один и тот же seed с теми же настройками даёт тот же результат.">
      <input id="seed" className="input mono" value={settings.seed} maxLength={64} spellCheck={false} placeholder="пусто — случайный" onChange={(e) => setSettings((s) => ({ ...s, seed: e.target.value }))} />
      <div className="btn-row">
        <Button small icon="dice" onClick={() => setSettings((s) => ({ ...s, seed: makeSeed() }))}>
          Случайный
        </Button>
        <Button small icon="lock" disabled={!current} onClick={pinSeed}>
          Из результата
        </Button>
        <Button
          small
          icon="close"
          disabled={!settings.seed}
          onClick={() => {
            setSettings((s) => ({ ...s, seed: '' }));
            toast('Seed очищен — снова будет выбираться случайно.', 'info');
          }}
        >
          Очистить
        </Button>
      </div>
    </Field>
  );
}

function CharacterCard() {
  const { character, makeCharacter, renameCharacter, clearCharacter, exportCharacter, current } = useStudio();
  if (!character) {
    return (
      <div className="callout">
        <p>Паспорт персонажа ещё не создан. Он появится после первой генерации в этом режиме или по текущему кадру.</p>
        <Button small icon="user" disabled={!current} onClick={makeCharacter}>
          Создать по текущему кадру
        </Button>
      </div>
    );
  }
  const p = character.subject;
  return (
    <div className="callout">
      <Field label="Имя (только внутри приложения)" id="char-name">
        <input id="char-name" className="input" value={character.name} maxLength={60} onChange={(e) => renameCharacter(e.target.value)} />
      </Field>
      <p className="muted">
        ID {character.id} · {p.age} лет · волосы {p.hairColor.replace(/-/g, ' ')}, глаза {p.eyeColor.replace(/-/g, ' ')}
      </p>
      <p className="hint">Текстовое описание не гарантирует одно и то же лицо в сторонней модели.</p>
      <div className="btn-row">
        <Button small icon="download" onClick={() => exportCharacter('txt')}>
          Character sheet TXT
        </Button>
        <Button small icon="download" onClick={() => exportCharacter('json')}>
          JSON
        </Button>
        <Button small icon="user" disabled={!current} onClick={makeCharacter}>
          Заменить по кадру
        </Button>
        <Button small variant="danger" icon="trash" onClick={() => void clearCharacter()}>
          Удалить
        </Button>
      </div>
    </div>
  );
}

function ModeBlock() {
  const { settings, setSettings } = useStudio();
  return (
    <div className="stack">
      <div className="segmented segmented-wide" role="group" aria-label="Режим генерации">
        {MODES.map((m) => (
          <Chip key={m} pressed={settings.mode === m} onClick={() => setSettings((s) => ({ ...s, mode: m }))}>
            {L_MODE[m]}
          </Chip>
        ))}
      </div>
      <p className="hint">{MODE_HELP[settings.mode]}</p>
      {settings.mode === 'character' ? <CharacterCard /> : null}
      {settings.mode === 'series' ? (
        <div className="row2">
          <Slider label="Кадров в серии" value={settings.seriesLength} min={2} max={12} onChange={(v) => setSettings((s) => ({ ...s, seriesLength: v }))} />
          <Select label="Тема серии" value={settings.seriesTheme} options={SERIES_THEMES.map((v) => ({ value: v, label: L_SERIES_THEME[v] }))} onChange={(v) => setSettings((s) => ({ ...s, seriesTheme: v }))} />
        </div>
      ) : null}
    </div>
  );
}

function RatioField() {
  const { settings, setSettings } = useStudio();
  const r = settings.ratio;
  const valid = isValidCustomRatio(r.custom.w, r.custom.h);
  const setRatio = (patch: Partial<Settings['ratio']>) => setSettings((s) => ({ ...s, ratio: { ...s.ratio, ...patch } }));
  return (
    <div className="stack">
      <div className="chips" role="group" aria-label="Формат кадра">
        <Chip pressed={r.mode === 'auto'} onClick={() => setRatio({ mode: 'auto' })}>
          Авто
        </Chip>
        {RATIO_IDS.map((id) => (
          <Chip key={id} pressed={r.mode === 'preset' && r.preset === id} onClick={() => setRatio({ mode: 'preset', preset: id })}>
            {id}
          </Chip>
        ))}
        <Chip pressed={r.mode === 'custom'} onClick={() => setRatio({ mode: 'custom' })}>
          Свой
        </Chip>
      </div>
      {r.mode === 'custom' ? (
        <div className="row2">
          <NumberField label="Ширина" value={r.custom.w} min={1} max={99} error={valid ? null : 'Допустимо 1–99, не круче 1:4 и 4:1.'} onChange={(v) => setRatio({ custom: { ...r.custom, w: v } })} />
          <NumberField label="Высота" value={r.custom.h} min={1} max={99} onChange={(v) => setRatio({ custom: { ...r.custom, h: v } })} />
        </div>
      ) : null}
      <Select
        label="Ориентация"
        value={settings.orientation}
        disabled={r.mode !== 'auto'}
        options={[
          { value: 'auto', label: 'Авто' },
          { value: 'vertical', label: 'Вертикально' },
          { value: 'horizontal', label: 'Горизонтально' },
        ]}
        onChange={(v) => setSettings((s) => ({ ...s, orientation: v }))}
        hint="Формат передаётся меткой и инструкцией композиции; сторонняя модель может выдержать размер неточно."
      />
    </div>
  );
}

function SelfieSlider() {
  const { settings, setSettings } = useStudio();
  const total = CAPTURES.reduce((a, c) => a + settings.captureShares[c], 0) || 1;
  const selfies = (['selfie-arm', 'selfie-mirror', 'selfie-reflection', 'front-camera'] as const).reduce((a, c) => a + settings.captureShares[c], 0);
  const pct = Math.round((selfies / total) * 100);
  const setPct = (v: number) =>
    setSettings((s) => {
      const keys = ['selfie-arm', 'selfie-mirror', 'selfie-reflection', 'front-camera'] as const;
      const others = CAPTURES.filter((c) => !(keys as readonly string[]).includes(c));
      const base = { ...DEFAULT_CAPTURE_SHARES };
      const sSum = keys.reduce((a, c) => a + base[c], 0);
      const oSum = others.reduce((a, c) => a + base[c], 0);
      const next = { ...s.captureShares };
      for (const c of keys) next[c] = Math.round((base[c] / sSum) * v);
      for (const c of others) next[c] = Math.round((base[c] / oSum) * (100 - v));
      if (Object.values(next).every((x) => x === 0)) return s;
      return { ...s, captureShares: next };
    });
  return <Slider label="Доля селфи" value={pct} min={0} max={100} step={5} onChange={setPct} format={(v) => `${v} %`} hint="Подробные доли по типам съёмки — во вкладке «Расширенные»." />;
}

function ShareSliders() {
  const { settings, setSettings } = useStudio();
  const total = CAPTURES.reduce((a, c) => a + settings.captureShares[c], 0);
  return (
    <div className="stack">
      <p className="hint">Значения нормализуются автоматически: сумма всегда 100 %. Ноль — тип съёмки не используется.</p>
      {CAPTURES.map((c) => (
        <Slider key={c} label={L_CAPTURE[c]} value={settings.captureShares[c]} min={0} max={100} onChange={(v) => setSettings((s) => ({ ...s, captureShares: { ...s.captureShares, [c]: v } }))} format={(v) => `${total > 0 ? Math.round((v / total) * 100) : 0} %`} />
      ))}
      {total === 0 ? <p className="err">Все доли равны нулю — будут использованы значения по умолчанию.</p> : null}
      <Button small icon="refresh" onClick={() => setSettings((s) => ({ ...s, captureShares: { ...DEFAULT_CAPTURE_SHARES } }))}>
        Вернуть доли по умолчанию
      </Button>
    </div>
  );
}

function LocksPanel() {
  const { settings, toggleLock, current } = useStudio();
  return (
    <div className="stack">
      <p className="hint">Закреплённый параметр при следующей генерации берётся из текущего кадра и не меняется. {current ? 'Закрепляйте также кнопкой 🔒 рядом с параметрами результата.' : 'Сначала сгенерируйте кадр — закреплять пока нечего.'}</p>
      <div className="chips" role="group" aria-label="Закреплённые параметры">
        {LOCK_KEYS.map((k) => (
          <Chip key={k} pressed={settings.locks.includes(k)} onClick={() => toggleLock(k)} disabled={!current && !settings.locks.includes(k)}>
            {settings.locks.includes(k) ? '🔒 ' : ''}
            {L_LOCK[k]}
          </Chip>
        ))}
      </div>
      {settings.locks.length > 0 ? <p className="hint">Закреплено: {settings.locks.length}. Чем больше закреплено, тем меньше разнообразие.</p> : null}
    </div>
  );
}

function OutputBlock() {
  const { settings, setSettings } = useStudio();
  return (
    <div className="stack">
      <Select label="Стиль съёмки" value={settings.style} options={STYLES.map((v) => ({ value: v, label: L_STYLE[v] }))} onChange={(v) => setSettings((s) => ({ ...s, style: v }))} />
      <Select label="Длина промпта" value={settings.length} options={LENGTHS.map((v) => ({ value: v, label: L_LENGTH[v] }))} onChange={(v) => setSettings((s) => ({ ...s, length: v }))} />
      <Select label="Профиль экспорта" value={settings.profile} options={PROFILES.map((v) => ({ value: v, label: L_PROFILE[v] }))} onChange={(v) => setSettings((s) => ({ ...s, profile: v }))} hint={PROFILE_HELP[settings.profile]} />
      <Toggle checked={settings.includeNegative} onChange={(v) => setSettings((s) => ({ ...s, includeNegative: v }))} label="Negative prompt" hint="Необязательный список нежелательных артефактов." />
      <Toggle checked={settings.showRussian} onChange={(v) => setSettings((s) => ({ ...s, showRussian: v }))} label="Показывать описание по-русски" hint="Краткий пересказ параметров сцены; основной промпт остаётся английским." />
    </div>
  );
}

export function SettingsPanel() {
  const { settings, setSettings, settingsTab, setSettingsTab, randomizeAll, resetSettings, feasible } = useStudio();
  const wide = useIsWide();
  const open = wide;
  return (
    <aside className="settings" aria-label="Настройки генерации">
      <Tabs label="Режим настроек" idPrefix="settings" tabs={[{ id: 'quick', label: 'Быстрые' }, { id: 'advanced', label: 'Расширенные' }]} value={settingsTab} onChange={setSettingsTab} />
      <div className="settings-meta">
        <span>
          Подходит локаций: <strong>{feasible}</strong> из {ALL_SCENES.length}
        </span>
        <div className="btn-row">
          <Button small icon="dice" onClick={randomizeAll}>
            Случайно всё
          </Button>
          <Button small icon="refresh" onClick={() => void resetSettings()}>
            Сбросить
          </Button>
        </div>
      </div>
      <TabPanel idPrefix="settings" id="quick" active={settingsTab === 'quick'}>
        <Section title="Режим и seed" defaultOpen>
          <ModeBlock />
          <SeedField />
          <div className="field">
            <span className="field-label">Баланс разнообразия и реализма</span>
            <div className="segmented segmented-wide" role="group" aria-label="Баланс">
              {BALANCES.map((b) => (
                <Chip key={b} pressed={settings.balance === b} onClick={() => setSettings((s) => ({ ...s, balance: b }))}>
                  {L_BALANCE[b]}
                </Chip>
              ))}
            </div>
            <p className="hint">Реалистичность отключить нельзя. Абсолютная уникальность не гарантируется: при большом числе закреплений и ограничений разнообразие закономерно снижается.</p>
          </div>
        </Section>
        <Section title="Возраст" defaultOpen={open}>
          <AgeField />
        </Section>
        <Section title="Съёмка и формат" defaultOpen={open}>
          <SelfieSlider />
          <Toggle checked={settings.faceRequired} onChange={(v) => setSettings((s) => ({ ...s, faceRequired: v }))} label="Лицо обязательно видно" hint="Исключает ракурсы со спины и с закрытым лицом." />
          <RatioField />
        </Section>
        <Section title="Мир кадра" defaultOpen={open}>
          <ChoiceField k="season" />
          <ChoiceField k="weather" />
          <ChoiceField k="time" />
          <ChoiceField k="category" />
        </Section>
        <Section title="Вид и вывод" defaultOpen={open}>
          <OutputBlock />
        </Section>
      </TabPanel>
      <TabPanel idPrefix="settings" id="advanced" active={settingsTab === 'advanced'}>
        <Section title="Внешность" defaultOpen>
          {(['hairColor', 'hairLength', 'hairType', 'hairStyle', 'eyeColor', 'skinTone', 'build', 'height', 'makeup', 'freckles', 'glasses', 'clothingStyle'] as const).map((k) => (
            <ChoiceField key={k} k={k} />
          ))}
        </Section>
        <Section title="Доли типов съёмки">
          <ShareSliders />
        </Section>
        <Section title="Ракурс, кадр, поза, эмоции">
          <ChoiceField k="framing" />
          <ChoiceField k="angle" />
          <ChoiceField k="posture" />
          <ChoiceField k="emotion" options={settings.allowSadEmotions ? CHOICE_OPTIONS.emotion : CHOICE_OPTIONS.emotion.filter((e) => e !== 'sad' && e !== 'crying')} />
          <Toggle checked={settings.allowSadEmotions} onChange={(v) => setSettings((s) => ({ ...s, allowSadEmotions: v }))} label="Разрешить грусть и слёзы" hint="По умолчанию выключено: основные эмоции — лёгкая улыбка и спокойствие." />
        </Section>
        <Section title="Локации и климат">
          <SceneField />
          <Select label="Климат" value={settings.climate} options={[{ value: 'auto', label: 'Авто (умеренный)' }, ...CLIMATES.map((c) => ({ value: c, label: L_CLIMATE[c] }))]} onChange={(v) => setSettings((s) => ({ ...s, climate: v }))} hint="Определяет, возможны ли снег и мороз, и насколько тепло одеваются." />
          {RARITIES.map((r) => (
            <Slider key={r} label={`Редкость: ${L_RARITY[r].toLowerCase()}`} value={settings.rarity[r]} min={0} max={100} onChange={(v) => setSettings((s) => ({ ...s, rarity: { ...s.rarity, [r]: v } }))} format={(v) => `${v} %`} />
          ))}
          <Toggle checked={settings.backgroundPeople} onChange={(v) => setSettings((s) => ({ ...s, backgroundPeople: v }))} label="Случайные люди на фоне" hint="Только вдали и только там, где это логично. Главная героиня всегда одна." />
        </Section>
        <Section title="Стиль и детали">
          <Select label="Цвет" value={settings.color} options={COLORS.map((v) => ({ value: v, label: L_COLOR[v] }))} onChange={(v) => setSettings((s) => ({ ...s, color: v }))} />
          <Select label="Резкость фона" value={settings.sharpness} options={SHARPNESS.map((v) => ({ value: v, label: L_SHARPNESS[v] }))} onChange={(v) => setSettings((s) => ({ ...s, sharpness: v }))} hint="Размытие включается только по явному выбору." />
          <Select label="Уровень деталей" value={settings.detailLevel} options={DETAIL_LEVELS.map((v) => ({ value: v, label: L_DETAIL[v] }))} onChange={(v) => setSettings((s) => ({ ...s, detailLevel: v }))} />
          <Slider label="Спонтанность" value={settings.spontaneity} min={0} max={100} onChange={(v) => setSettings((s) => ({ ...s, spontaneity: v }))} hint="Выше — больше случайных кадров, взгляда мимо камеры и движения." />
          <Slider label="Сила случайности" value={settings.randomness} min={0} max={100} onChange={(v) => setSettings((s) => ({ ...s, randomness: v }))} hint="Ниже — чаще типичные варианты, выше — ровнее выбор и больше редкого." />
          <Toggle checked={settings.imperfections} onChange={(v) => setSettings((s) => ({ ...s, imperfections: v }))} label="Лёгкие фотонесовершенства" hint="Небольшой наклон, шум, смаз — как в обычной съёмке." />
        </Section>
        <Section title="Повторы и история">
          <Slider label="Окно антидубликатов" value={settings.dupWindow} min={0} max={200} onChange={(v) => setSettings((s) => ({ ...s, dupWindow: v }))} format={(v) => (v === 0 ? 'выкл.' : `${v} кадров`)} hint="Сравнение с последними кадрами по «локация + поза + съёмка + одежда» и общему сходству." />
          <NumberField label="Хранить в истории, записей" value={settings.historyLimit} min={20} max={2000} onChange={(v) => setSettings((s) => ({ ...s, historyLimit: v }))} hint="Избранное при очистке лимита сохраняется." />
        </Section>
        <Section title="Фиксация параметров" badge={settings.locks.length || undefined}>
          <LocksPanel />
        </Section>
      </TabPanel>
    </aside>
  );
}
