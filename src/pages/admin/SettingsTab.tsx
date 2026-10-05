/** Event date, slot times/length, the booking open/close switch, and maintenance. */
import { useEffect, useState, type FormEvent } from 'react';
import { LogOut, RotateCcw, Trash2, Users } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { useToast } from '../../components/Toast';
import { Button, Card, Field, Notice, SelectField, Switch } from '../../components/ui';
import { api } from '../../lib/api';
import type { MaintenanceAction } from '../../lib/api/api';
import { resetDemo } from '../../lib/api/demoApi';
import { useI18n, type MessageKey } from '../../lib/i18n';
import { useLive } from '../../lib/live';
import { fmtDate, fmtRange, slotStarts } from '../../lib/time';
import { errorCode, type ErrorCode, type Settings } from '../../lib/types';
import { useAdmin } from './AdminPage';

export function SettingsTab() {
  const { t, lang } = useI18n();
  const { settings } = useLive();
  const { token, run } = useAdmin();
  const [f, setF] = useState<Settings | null>(settings);
  const [busy, setBusy] = useState(false);
  useEffect(() => setF(settings), [settings]);
  if (!f || !settings) return null;

  const valid = f.dayStart < f.dayEnd && /^\d{4}-\d{2}-\d{2}$/.test(f.eventDate);
  const starts = valid ? slotStarts(f) : [];
  const changed = JSON.stringify(f) !== JSON.stringify(settings);

  return (
    <div className="max-w-xl space-y-5">
      <Card className="space-y-5 p-5">
        <Field label={t('a_s_date')} type="date" value={f.eventDate} onChange={(e) => setF({ ...f, eventDate: e.target.value })} hint={t('a_s_dateNote')} />
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('a_s_start')} type="time" step={300} value={f.dayStart} onChange={(e) => setF({ ...f, dayStart: e.target.value })} />
          <Field label={t('a_s_end')} type="time" step={300} value={f.dayEnd} onChange={(e) => setF({ ...f, dayEnd: e.target.value })} />
        </div>
        <SelectField
          label={t('a_s_length')}
          value={String(f.slotMinutes)}
          onChange={(v) => setF({ ...f, slotMinutes: Number(v) })}
          options={[5, 10, 15, 20, 30].map((m) => ({ value: String(m), label: t('minutes', { n: m }) }))}
        />
        <div className="flex items-center justify-between gap-3 rounded-md bg-surface-page px-4 py-3">
          <span className="text-sm font-semibold text-foreground">{t('a_s_open')}</span>
          <Switch checked={f.bookingOpen} onChange={(v) => setF({ ...f, bookingOpen: v })} label={t('a_s_open')} />
        </div>
        {starts.length > 0 && (
          <p className="rounded-md bg-action-tint px-4 py-3 text-sm text-foreground">
            <span className="font-semibold">{fmtDate(f.eventDate, lang)}</span>
            <br />
            {t('a_s_preview', {
              n: starts.length,
              first: fmtRange(starts[0], f.slotMinutes),
              last: fmtRange(starts[starts.length - 1], f.slotMinutes),
            })}
          </p>
        )}
        <Button
          block
          loading={busy}
          disabled={!valid || !changed}
          onClick={async () => {
            setBusy(true);
            await run(() => api.adminSaveSettings(token, f), t('saved'));
            setBusy(false);
          }}
        >
          {t('save')}
        </Button>
      </Card>

      <MaintenanceCard />

      {api.mode === 'demo' && (
        <Button variant="ghost" icon={<RotateCcw className="size-4" aria-hidden />} onClick={resetDemo}>
          {t('a_s_resetDemo')}
        </Button>
      )}
    </div>
  );
}

const ACTIONS: { id: MaintenanceAction; label: MessageKey; hint: MessageKey; icon: typeof LogOut }[] = [
  { id: 'sign_out_teachers', label: 'a_m_signOutTeachers', hint: 'a_m_signOutTeachersHint', icon: LogOut },
  { id: 'sign_out_all', label: 'a_m_signOutAll', hint: 'a_m_signOutAllHint', icon: Users },
  { id: 'clear_bookings', label: 'a_m_clearBookings', hint: 'a_m_clearBookingsHint', icon: Trash2 },
];

/** Sign everyone out or wipe all bookings. Every action asks for the admin password again. */
function MaintenanceCard() {
  const { t, errorText } = useI18n();
  const toast = useToast();
  const { token, refresh } = useAdmin();
  const [action, setAction] = useState<(typeof ACTIONS)[number] | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);

  const close = () => {
    setAction(null);
    setPassword('');
    setError(null);
  };

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!action) return;
    setBusy(true);
    setError(null);
    try {
      const n = await api.adminMaintenance(token, password, action.id);
      toast(t('a_m_done', { n }), 'success');
      close();
      refresh();
    } catch (err) {
      setError(errorCode(err));
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <h2 className="text-lg font-bold text-foreground">{t('a_m_title')}</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">{t('a_m_intro')}</p>
      <ul className="space-y-3">
        {ACTIONS.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-page px-4 py-3">
            <p className="min-w-0 flex-1 text-[13px] text-muted-foreground">{t(a.hint)}</p>
            <Button
              size="sm"
              variant={a.id === 'clear_bookings' ? 'danger' : 'secondary'}
              icon={<a.icon className="size-4" aria-hidden />}
              onClick={() => setAction(a)}
            >
              {t(a.label)}
            </Button>
          </li>
        ))}
      </ul>

      <BottomSheet open={Boolean(action)} onClose={close} title={t('a_m_confirmTitle')}>
        {action && (
          <form onSubmit={confirm} className="space-y-4">
            <p className="text-sm text-foreground">
              <span className="font-semibold">{t(action.label)}</span> — {t(action.hint)}
            </p>
            <Field
              label={t('a_password')}
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <Notice tone="error">{errorText(error)}</Notice>}
            <Button type="submit" block loading={busy} disabled={!password} variant={action.id === 'clear_bookings' ? 'danger' : 'primary'}>
              {t('a_m_confirm')}
            </Button>
          </form>
        )}
      </BottomSheet>
    </Card>
  );
}
