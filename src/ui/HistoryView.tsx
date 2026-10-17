import { useMemo, useState } from 'react';
import { L_CAPTURE, L_CATEGORY, L_MODE, L_SEASON } from '../core/labels.ts';
import { CAPTURES, CATEGORIES, MODES, SEASONS } from '../core/vocab.ts';
import { filterHistory } from '../storage/history.ts';
import type { HistoryEntry, HistoryFilter } from '../storage/history.ts';
import { useStudio } from './store.tsx';
import { Button, Chip, IconButton, Toggle } from './ui.tsx';

const PAGE = 24;

function Entry({ e }: { e: HistoryEntry }) {
  const { openEntry, toggleFavorite, removeEntry, copyEntry, downloadEntry } = useStudio();
  const s = e.scenario;
  return (
    <li className="entry">
      <div className="entry-head">
        <strong>{s.sceneTitle}</strong>
        <time dateTime={new Date(e.createdAt).toISOString()} className="muted">
          {new Date(e.createdAt).toLocaleString('ru-RU')}
        </time>
      </div>
      <p className="entry-text">{e.main.length > 260 ? `${e.main.slice(0, 260)}…` : e.main}</p>
      <ul className="facts" aria-label="Параметры записи">
        <li className="fact">{L_MODE[s.mode]}</li>
        <li className="fact">{L_CAPTURE[s.capture]}</li>
        <li className="fact">{L_SEASON[s.season]}</li>
        <li className="fact">{s.ratio.label}</li>
        <li className="fact mono">{s.seed}</li>
      </ul>
      <div className="btn-row">
        <Button small icon="search" onClick={() => openEntry(e.id)}>
          Открыть
        </Button>
        <Button small icon="copy" onClick={() => void copyEntry(e, true)}>
          Копировать
        </Button>
        <Button small icon="download" onClick={() => downloadEntry(e, 'txt')}>
          TXT
        </Button>
        <Button small icon="download" onClick={() => downloadEntry(e, 'json')}>
          JSON
        </Button>
        <IconButton icon="star" filled={e.favorite} pressed={e.favorite} label={e.favorite ? 'Убрать из избранного' : 'В избранное'} onClick={() => toggleFavorite(e.id)} />
        <IconButton icon="trash" label="Удалить запись" onClick={() => void removeEntry(e.id)} />
      </div>
    </li>
  );
}

export function HistoryView() {
  const { history, historyReady, historyPersistent, clearHistory, exportEntries } = useStudio();
  const [f, setF] = useState<HistoryFilter>({ query: '', favoritesOnly: false, mode: 'all', category: 'all', season: 'all', capture: 'all' });
  const [shown, setShown] = useState(PAGE);
  const list = useMemo(() => filterHistory(history, f), [history, f]);
  const upd = (p: Partial<HistoryFilter>) => {
    setF((x) => ({ ...x, ...p }));
    setShown(PAGE);
  };
  const filtersOn = !!(f.query || f.favoritesOnly || f.mode !== 'all' || f.category !== 'all' || f.season !== 'all' || f.capture !== 'all');
  return (
    <section className="page" aria-labelledby="history-title">
      <header className="page-head">
        <h2 id="history-title">История и избранное</h2>
        <p className="muted">Всего записей: {history.length}. Каждая запись хранит seed, все параметры сценария, снимок настроек и итоговый текст.</p>
      </header>
      {!historyPersistent ? <div className="callout callout-warn">Хранилище браузера недоступно — история живёт только до закрытия вкладки.</div> : null}
      <div className="toolbar" role="search" aria-label="Поиск и фильтры истории">
        <div className="field grow">
          <label className="field-label" htmlFor="h-q">
            Поиск
          </label>
          <input id="h-q" className="input" type="search" value={f.query ?? ''} onChange={(e) => upd({ query: e.target.value })} placeholder="текст промпта, seed, локация…" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="h-mode">
            Режим
          </label>
          <select id="h-mode" className="select" value={f.mode} onChange={(e) => upd({ mode: e.target.value as HistoryFilter['mode'] })}>
            <option value="all">Все</option>
            {MODES.map((m) => (
              <option key={m} value={m}>
                {L_MODE[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="h-cat">
            Категория
          </label>
          <select id="h-cat" className="select" value={f.category} onChange={(e) => upd({ category: e.target.value as HistoryFilter['category'] })}>
            <option value="all">Все</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {L_CATEGORY[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="h-season">
            Сезон
          </label>
          <select id="h-season" className="select" value={f.season} onChange={(e) => upd({ season: e.target.value as HistoryFilter['season'] })}>
            <option value="all">Все</option>
            {SEASONS.map((c) => (
              <option key={c} value={c}>
                {L_SEASON[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="h-cap">
            Тип съёмки
          </label>
          <select id="h-cap" className="select" value={f.capture} onChange={(e) => upd({ capture: e.target.value as HistoryFilter['capture'] })}>
            <option value="all">Все</option>
            {CAPTURES.map((c) => (
              <option key={c} value={c}>
                {L_CAPTURE[c]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="toolbar toolbar-actions">
        <Toggle checked={!!f.favoritesOnly} onChange={(v) => upd({ favoritesOnly: v })} label="Только избранное" />
        <div className="btn-row">
          <span className="muted">Найдено: {list.length}. Экспорт найденного:</span>
          <Chip pressed={false} onClick={() => exportEntries(list, 'csv', 'realphoto-history')}>
            CSV
          </Chip>
          <Chip pressed={false} onClick={() => exportEntries(list, 'json', 'realphoto-history')}>
            JSON
          </Chip>
          <Chip pressed={false} onClick={() => exportEntries(list, 'txt', 'realphoto-history')}>
            TXT
          </Chip>
          <Button small variant="danger" icon="trash" disabled={history.length === 0} onClick={() => void clearHistory()}>
            Очистить историю
          </Button>
        </div>
      </div>
      {!historyReady ? <p className="muted">Загрузка истории…</p> : null}
      {historyReady && history.length === 0 ? (
        <div className="empty">
          <h3>История пуста</h3>
          <p>Сгенерируйте первый кадр на вкладке «Студия» — он сохранится здесь автоматически.</p>
        </div>
      ) : null}
      {historyReady && history.length > 0 && list.length === 0 ? (
        <div className="empty">
          <h3>Ничего не найдено</h3>
          <p>{filtersOn ? 'Попробуйте изменить запрос или сбросить фильтры.' : ''}</p>
          <Button small onClick={() => setF({ query: '', favoritesOnly: false, mode: 'all', category: 'all', season: 'all', capture: 'all' })}>
            Сбросить фильтры
          </Button>
        </div>
      ) : null}
      <ul className="entries">
        {list.slice(0, shown).map((e) => (
          <Entry key={e.id} e={e} />
        ))}
      </ul>
      {list.length > shown ? (
        <Button onClick={() => setShown((n) => n + PAGE)}>Показать ещё ({list.length - shown})</Button>
      ) : null}
    </section>
  );
}
