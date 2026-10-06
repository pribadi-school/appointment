/**
 * Admin area (password set from the ADMIN_PASSWORD env var at setup).
 * Tabs: Dashboard · Bookings · Teachers · Event settings · QR code.
 * Everything a school staff member needs to run the day without code.
 */
import { createContext, useCallback, useContext, useEffect, useState, type FormEvent } from 'react';
import { CalendarCog, LayoutGrid, List, LogOut, QrCode, Users } from 'lucide-react';
import { Header } from '../../components/Header';
import { useToast } from '../../components/Toast';
import { Button, Field, Notice, cx } from '../../components/ui';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useLive } from '../../lib/live';
import { KEYS, load, save } from '../../lib/storage';
import { errorCode, type Booking, type ErrorCode, type Session } from '../../lib/types';
import { Dashboard } from './Dashboard';
import { BookingsTab } from './BookingsTab';
import { TeachersTab } from './TeachersTab';
import { SettingsTab } from './SettingsTab';
import { QrTab } from './QrTab';

type AdminCtx = {
  token: string;
  bookings: Booking[] | null;
  refresh: () => Promise<void>;
  /** Run an admin action; shows a friendly toast on error. Returns true on success. */
  run: (fn: () => Promise<unknown>, okText?: string) => Promise<boolean>;
};
const Ctx = createContext<AdminCtx | null>(null);
export const useAdmin = () => useContext(Ctx)!;

type Tab = 'dashboard' | 'bookings' | 'teachers' | 'settings' | 'qr';

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(() => {
    const s = load<Session | null>(KEYS.adminSession, null);
    return s && s.expiresAt > Date.now() ? s : null;
  });
  const signIn = (s: Session) => {
    save(KEYS.adminSession, s);
    setSession(s);
  };
  const signOut = useCallback(() => {
    if (session) api.logout(session.token).catch(() => {});
    save(KEYS.adminSession, null);
    setSession(null);
  }, [session]);
  return session ? <AdminShell token={session.token} onSignOut={signOut} /> : <AdminLogin onSignIn={signIn} />;
}

function AdminLogin({ onSignIn }: { onSignIn: (s: Session) => void }) {
  const { t, errorText } = useI18n();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSignIn(await api.adminLogin(password));
    } catch (err) {
      setError(errorCode(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="min-h-dvh">
      <Header title={t('a_title')} />
      <main className="mx-auto max-w-md px-4 pt-8">
        <h1 className="mb-6 text-2xl font-bold">{t('a_signInTitle')}</h1>
        <form onSubmit={submit} className="space-y-5">
          <Field label={t('a_password')} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <Notice tone="error">{errorText(error)}</Notice>}
          <Button type="submit" block loading={busy} disabled={!password}>
            {t('a_signIn')}
          </Button>
        </form>
      </main>
    </div>
  );
}

function AdminShell({ token, onSignOut }: { token: string; onSignOut: () => void }) {
  const { t, errorText } = useI18n();
  const toast = useToast();
  const { version } = useLive();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [bookings, setBookings] = useState<Booking[] | null>(null);

  const handle = useCallback(
    (e: unknown) => {
      const code = errorCode(e);
      toast(errorText(code), 'error');
      if (code === 'SESSION_EXPIRED') onSignOut();
    },
    [toast, errorText, onSignOut],
  );

  const refresh = useCallback(async () => {
    try {
      setBookings(await api.adminBookings(token));
    } catch (e) {
      handle(e);
    }
  }, [token, handle]);

  useEffect(() => {
    refresh();
  }, [refresh, version]);

  const run = useCallback(
    async (fn: () => Promise<unknown>, okText?: string) => {
      try {
        await fn();
        if (okText) toast(okText, 'success');
        refresh();
        return true;
      } catch (e) {
        handle(e);
        refresh();
        return false;
      }
    },
    [toast, refresh, handle],
  );

  const tabs: { id: Tab; label: string; icon: typeof LayoutGrid }[] = [
    { id: 'dashboard', label: t('a_tab_dashboard'), icon: LayoutGrid },
    { id: 'bookings', label: t('a_tab_bookings'), icon: List },
    { id: 'teachers', label: t('a_tab_teachers'), icon: Users },
    { id: 'settings', label: t('a_tab_settings'), icon: CalendarCog },
    { id: 'qr', label: t('a_tab_qr'), icon: QrCode },
  ];

  return (
    <Ctx.Provider value={{ token, bookings, refresh, run }}>
      <div className="min-h-dvh">
        <Header
          title={t('a_title')}
          wide
          right={
            <button type="button" onClick={onSignOut} aria-label={t('a_signOut')} className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-surface-page hover:text-foreground">
              <LogOut className="size-[18px]" aria-hidden />
            </button>
          }
        />
        <nav aria-label={t('a_title')} className="no-print sticky top-16 z-30 border-b border-border-strong bg-surface sm:top-[72px]">
          <div className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4 xl:px-8" role="tablist">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cx(
                  // Underline tabs: the selected tab gets a 2px brand-blue bar, not a floating pill.
                  'inline-flex h-12 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold transition-colors duration-150',
                  tab === id ? 'border-action text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </nav>
        <main className="mx-auto max-w-[1600px] px-4 pt-5 pb-16 xl:px-8" role="tabpanel">
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'bookings' && <BookingsTab />}
          {tab === 'teachers' && <TeachersTab />}
          {tab === 'settings' && <SettingsTab />}
          {tab === 'qr' && <QrTab />}
        </main>
      </div>
    </Ctx.Provider>
  );
}
