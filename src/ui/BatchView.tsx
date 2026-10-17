import { useState } from 'react';
import { L_MODE, L_CAPTURE } from '../core/labels.ts';
import { BATCH_SIZES, clampBatchCount } from '../engine/batch.ts';
import { useStudio } from './store.tsx';
import { Button, Chip, NumberField, ProgressBar, Toggle } from './ui.tsx';

export function BatchView() {
  const { settings, setSettings, batch, startBatch, cancelBatch, exportEntries, openEntry } = useStudio();
  const [addToHistory, setAddToHistory] = useState(true);
  const count = clampBatchCount(settings.batchCount);
  const invalid = !Number.isInteger(settings.batchCount) || settings.batchCount < 1 || settings.batchCount > 100;
  return (
    <section className="page" aria-labelledby="batch-title">
      <header className="page-head">
        <h2 id="batch-title">Пакетная генерация</h2>
        <p className="muted">От 1 до 100 кадров по текущим настройкам режима «{L_MODE[settings.mode]}». Интерфейс не зависает, процесс можно остановить в любой момент. Кадры получают seed вида «базовый-1…N», поэтому пакет воспроизводим.</p>
      </header>
      <div className="stack panel">
        <div className="chips" role="group" aria-label="Размер пакета">
          {BATCH_SIZES.map((n) => (
            <Chip key={n} pressed={count === n && !invalid} disabled={batch.running} onClick={() => setSettings((s) => ({ ...s, batchCount: n }))}>
              {n}
            </Chip>
          ))}
        </div>
        <NumberField label="Или своё число (1–100)" value={settings.batchCount} min={1} max={100} error={invalid ? 'Допустимо целое число от 1 до 100.' : null} onChange={(v) => setSettings((s) => ({ ...s, batchCount: v }))} />
        <Toggle checked={addToHistory} onChange={setAddToHistory} label="Добавлять кадры в историю" />
        <div className="btn-row">
          <Button variant="primary" icon="sparkles" disabled={batch.running || invalid} onClick={() => void startBatch(count, addToHistory)}>
            Запустить пакет
          </Button>
          <Button icon="close" disabled={!batch.running} onClick={cancelBatch}>
            Отмена
          </Button>
        </div>
      </div>
      {batch.total > 0 ? (
        <div className="panel stack" aria-live="polite">
          <ProgressBar value={batch.done} max={batch.total} label="Прогресс пакетной генерации" />
          <p>
            {batch.running ? 'Идёт генерация…' : batch.cancelled ? 'Остановлено.' : 'Готово.'} Обработано {batch.done} из {batch.total}
            {batch.failures ? `, не удалось: ${batch.failures}` : ''}
            {batch.tooStrict ? `, с неизбежными повторами: ${batch.tooStrict}` : ''}.
            {batch.title ? ` Серия «${batch.title}».` : ''}
          </p>
          {batch.finished && batch.items.length > 0 ? (
            <div className="btn-row">
              <span className="muted">Экспорт пакета:</span>
              <Button small icon="download" onClick={() => exportEntries(batch.items, 'csv')}>
                CSV
              </Button>
              <Button small icon="download" onClick={() => exportEntries(batch.items, 'json')}>
                JSON
              </Button>
              <Button small icon="download" onClick={() => exportEntries(batch.items, 'txt')}>
                TXT
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="empty">
          <h3>Пакет ещё не запускался</h3>
          <p>Выберите размер и нажмите «Запустить пакет». Результаты можно скачать в CSV, JSON или TXT.</p>
        </div>
      )}
      {batch.items.length > 0 ? (
        <ol className="entries">
          {batch.items.map((e, i) => (
            <li key={e.id} className="entry">
              <div className="entry-head">
                <strong>
                  {i + 1}. {e.scenario.sceneTitle}
                </strong>
                <span className="muted">
                  {L_CAPTURE[e.scenario.capture]} · {e.scenario.ratio.label} · {e.scenario.subject.age} лет
                </span>
              </div>
              <p className="entry-text">{e.main.length > 220 ? `${e.main.slice(0, 220)}…` : e.main}</p>
              <div className="btn-row">
                <Button small icon="search" onClick={() => openEntry(e.id)} disabled={!addToHistory}>
                  Открыть в студии
                </Button>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
