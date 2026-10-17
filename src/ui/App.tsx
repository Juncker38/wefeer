import { AboutView } from './AboutView.tsx';
import { BatchView } from './BatchView.tsx';
import { HistoryView } from './HistoryView.tsx';
import { PresetsView } from './PresetsView.tsx';
import { ResultPanel } from './ResultPanel.tsx';
import { SettingsPanel } from './SettingsPanel.tsx';
import { StudioProvider, useStudio } from './store.tsx';
import type { ThemePref, View } from './store.tsx';
import { Button, Dialog, Icon, IconButton } from './ui.tsx';

const NAV: { id: View; label: string }[] = [
  { id: 'studio', label: 'Студия' },
  { id: 'batch', label: 'Пакет' },
  { id: 'history', label: 'История' },
  { id: 'presets', label: 'Пресеты' },
  { id: 'about', label: 'О проекте' },
];

const THEMES: { id: ThemePref; label: string; icon: 'monitor' | 'sun' | 'moon' }[] = [
  { id: 'system', label: 'Тема: как в системе', icon: 'monitor' },
  { id: 'light', label: 'Тема: светлая', icon: 'sun' },
  { id: 'dark', label: 'Тема: тёмная', icon: 'moon' },
];

function Header() {
  const { view, setView, theme, setTheme, history } = useStudio();
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <Icon name="camera" size={20} />
        </span>
        <div>
          <h1>RealPhoto Prompt Studio</h1>
          <p className="brand-sub">Фотореалистичные промпты · офлайн · без регистрации</p>
        </div>
      </div>
      <nav className="nav" aria-label="Разделы">
        {NAV.map((n) => (
          <button key={n.id} type="button" className={`nav-item${view === n.id ? ' nav-on' : ''}`} aria-current={view === n.id ? 'page' : undefined} onClick={() => setView(n.id)}>
            {n.label}
            {n.id === 'history' && history.length ? <span className="count">{history.length}</span> : null}
          </button>
        ))}
      </nav>
      <div className="theme" role="group" aria-label="Тема оформления">
        {THEMES.map((t) => (
          <IconButton key={t.id} icon={t.icon} label={t.label} pressed={theme === t.id} onClick={() => setTheme(t.id)} />
        ))}
      </div>
    </header>
  );
}

function Toasts() {
  const { toasts, dismissToast } = useStudio();
  return (
    <div className="toasts" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <span>{t.text}</span>
          <IconButton icon="close" label="Закрыть уведомление" onClick={() => dismissToast(t.id)} />
        </div>
      ))}
    </div>
  );
}

function ConfirmHost() {
  const { confirmState } = useStudio();
  if (!confirmState) return null;
  return (
    <Dialog
      title={confirmState.title}
      onClose={() => confirmState.resolve(false)}
      footer={
        <>
          <Button variant={confirmState.danger ? 'danger' : 'primary'} onClick={() => confirmState.resolve(true)}>
            {confirmState.confirmLabel ?? 'Подтвердить'}
          </Button>
          <Button onClick={() => confirmState.resolve(false)}>Отмена</Button>
        </>
      }
    >
      <p>{confirmState.message}</p>
    </Dialog>
  );
}

function Main() {
  const { view, storageWarning } = useStudio();
  return (
    <main id="main" className="main" tabIndex={-1}>
      {storageWarning ? <div className="callout callout-warn">Не удаётся сохранить настройки в браузере (приватный режим или переполнено хранилище) — изменения пропадут после закрытия вкладки.</div> : null}
      {view === 'studio' ? (
        <div className="studio">
          <ResultPanel />
          <SettingsPanel />
        </div>
      ) : null}
      {view === 'batch' ? <BatchView /> : null}
      {view === 'history' ? <HistoryView /> : null}
      {view === 'presets' ? <PresetsView /> : null}
      {view === 'about' ? <AboutView /> : null}
    </main>
  );
}

export function App() {
  return (
    <StudioProvider>
      <a className="skip" href="#main" onClick={() => document.getElementById('main')?.focus()}>
        К содержимому
      </a>
      <Header />
      <Main />
      <footer className="footer">
        <p>Только текст — изображения не создаются. Всё работает локально в вашем браузере; данные никуда не отправляются.</p>
      </footer>
      <Toasts />
      <ConfirmHost />
    </StudioProvider>
  );
}
