import { useRef, useState } from 'react';
import { useStudio } from './store.tsx';
import { Button, Field } from './ui.tsx';

export function PresetsView() {
  const { builtinPresets, presets, applyPresetById, savePreset, renamePresetById, deletePresetById, downloadConfig, importConfigText, character, exportCharacter } = useStudio();
  const [name, setName] = useState('');
  const [paste, setPaste] = useState('');
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2_000_000) {
      setImportMsg({ ok: false, text: 'Файл слишком большой (больше 2 МБ).' });
      return;
    }
    const r = importConfigText(await file.text());
    setImportMsg({ ok: r.ok, text: r.message });
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <section className="page" aria-labelledby="presets-title">
      <header className="page-head">
        <h2 id="presets-title">Пресеты и конфигурация</h2>
        <p className="muted">Пресет сохраняет настройки целиком (кроме seed и закреплений). Конфигурацию можно перенести на другое устройство файлом.</p>
      </header>

      <section className="panel stack" aria-labelledby="builtin-title">
        <h3 id="builtin-title">Готовые пресеты</h3>
        <ul className="cards">
          {builtinPresets.map((p) => (
            <li key={p.id} className="card">
              <strong>{p.name}</strong>
              <p className="muted">{p.description}</p>
              <Button small icon="check" onClick={() => applyPresetById(p.id)}>
                Применить
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel stack" aria-labelledby="user-title">
        <h3 id="user-title">Мои пресеты</h3>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (savePreset(name)) setName('');
          }}
        >
          <Field label="Сохранить текущие настройки как пресет" id="preset-name">
            <input id="preset-name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="например: Мой зимний набор" />
          </Field>
          <Button type="submit" variant="primary" icon="save">
            Сохранить пресет
          </Button>
        </form>
        {presets.length === 0 ? <p className="muted">Собственных пресетов пока нет.</p> : null}
        <ul className="cards">
          {presets.map((p) => (
            <li key={p.id} className="card">
              {renaming?.id === p.id ? (
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    renamePresetById(p.id, renaming.value);
                    setRenaming(null);
                  }}
                >
                  <Field label="Новое название" id={`rn-${p.id}`}>
                    <input id={`rn-${p.id}`} className="input" value={renaming.value} maxLength={60} onChange={(e) => setRenaming({ id: p.id, value: e.target.value })} />
                  </Field>
                  <Button type="submit" small icon="check">
                    Готово
                  </Button>
                </form>
              ) : (
                <strong>{p.name}</strong>
              )}
              <div className="btn-row">
                <Button small icon="check" onClick={() => applyPresetById(p.id)}>
                  Применить
                </Button>
                <Button small icon="edit" onClick={() => setRenaming({ id: p.id, value: p.name })}>
                  Переименовать
                </Button>
                <Button small variant="danger" icon="trash" onClick={() => void deletePresetById(p.id)}>
                  Удалить
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel stack" aria-labelledby="config-title">
        <h3 id="config-title">Импорт и экспорт конфигурации</h3>
        <div className="btn-row">
          <Button icon="download" onClick={downloadConfig}>
            Экспорт конфигурации (JSON)
          </Button>
          <Button icon="upload" onClick={() => fileRef.current?.click()}>
            Импорт из файла
          </Button>
          <input ref={fileRef} className="visually-hidden" type="file" accept="application/json,.json" aria-label="Файл конфигурации" onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>
        <Field label="Или вставьте JSON конфигурации" id="cfg-paste" hint="Проверяются формат и диапазоны: повреждённые части отбрасываются с предупреждением.">
          <textarea id="cfg-paste" className="textarea mono" rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} spellCheck={false} />
        </Field>
        <div className="btn-row">
          <Button
            icon="upload"
            disabled={!paste.trim()}
            onClick={() => {
              const r = importConfigText(paste);
              setImportMsg({ ok: r.ok, text: r.message });
              if (r.ok) setPaste('');
            }}
          >
            Импортировать из текста
          </Button>
        </div>
        {importMsg ? (
          <p className={importMsg.ok ? 'ok' : 'err'} role="status">
            {importMsg.text}
          </p>
        ) : null}
      </section>

      <section className="panel stack" aria-labelledby="char-title">
        <h3 id="char-title">Персонаж</h3>
        {character ? (
          <>
            <p>
              {character.name} · ID {character.id} · {character.subject.age} лет. Имя и ID существуют только внутри приложения.
            </p>
            <div className="btn-row">
              <Button small icon="download" onClick={() => exportCharacter('txt')}>
                Character sheet TXT
              </Button>
              <Button small icon="download" onClick={() => exportCharacter('json')}>
                Character sheet JSON
              </Button>
            </div>
          </>
        ) : (
          <p className="muted">Персонаж не создан: выберите режим «Один персонаж» на вкладке «Студия» и сгенерируйте кадр.</p>
        )}
      </section>
    </section>
  );
}
