/** Event date, slot times/length and the booking open/close switch. */
import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button, Card, Field, SelectField, Switch } from '../../components/ui';
import { api } from '../../lib/api';
import { resetDemo } from '../../lib/api/demoApi';
import { useI18n } from '../../lib/i18n';
import { useLive } from '../../lib/live';
import { fmtDate, fmtRange, slotStarts } from '../../lib/time';
import type { Settings } from '../../lib/types';
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

      {api.mode === 'demo' && (
        <Button variant="ghost" icon={<RotateCcw className="size-4" aria-hidden />} onClick={resetDemo}>
          {t('a_s_resetDemo')}
        </Button>
      )}
    </div>
  );
}
