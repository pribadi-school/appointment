/** Searchable list of all bookings, with CSV / Excel export. */
import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Search } from 'lucide-react';
import { Button, Card, Skeleton, StatusPill } from '../../components/ui';
import { exportCsv, exportXlsx } from '../../lib/export';
import { useI18n } from '../../lib/i18n';
import { useLive } from '../../lib/live';
import { formatPhone } from '../../lib/phone';
import { classLabel } from '../../lib/teachers';
import { fmtTime } from '../../lib/time';
import { useAdmin } from './AdminPage';
import { SlotSheet } from './SlotSheet';

export function BookingsTab() {
  const { t, lang } = useI18n();
  const { teachers, settings } = useLive();
  const { bookings } = useAdmin();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<{ teacherId: string; slotStart: number } | null>(null);
  const byId = useMemo(() => new Map(teachers.map((x) => [x.id, x])), [teachers]);

  const list = useMemo(() => {
    const needle = q.toLowerCase().trim();
    return (bookings ?? [])
      .filter((b) => b.kind === 'booking')
      .filter(
        (b) =>
          !needle ||
          [b.childName, b.childClass, classLabel(b.childClass, t), b.parentName, b.code, b.phone, byId.get(b.teacherId)?.name].some((v) =>
            v?.toLowerCase().includes(needle),
          ),
      );
  }, [bookings, q, byId, t]);

  if (!bookings || !settings) return <Skeleton className="h-96 rounded-lg" />;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('a_searchBookings')}
            aria-label={t('a_searchBookings')}
            className="h-11 w-full rounded-md border border-border-strong bg-surface pr-3 pl-10 text-base outline-none focus:border-action focus:ring-1 focus:ring-action"
          />
        </div>
        <Button size="sm" variant="secondary" icon={<Download className="size-4" aria-hidden />} onClick={() => exportCsv(bookings, teachers, settings, t, lang)}>
          {t('a_exportCsv')}
        </Button>
        <Button size="sm" icon={<FileSpreadsheet className="size-4" aria-hidden />} onClick={() => exportXlsx(bookings, teachers, settings, t, lang)}>
          {t('a_exportXlsx')}
        </Button>
      </div>

      {list.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">{t('a_noBookings')}</p>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                {['a_col_time', 'a_col_teacher', 'a_col_room', 'a_col_child', 'a_col_parent', 'a_col_phone', 'a_col_status', 'a_col_code'].map((k) => (
                  <th key={k} className="px-3 py-2.5 font-bold">
                    {t(k as Parameters<typeof t>[0])}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((b) => {
                const teacher = byId.get(b.teacherId);
                return (
                  <tr key={b.id} onClick={() => setOpen({ teacherId: b.teacherId, slotStart: b.slotStart })} className="cursor-pointer hover:bg-surface-page">
                    <td className="px-3 py-2.5 font-bold text-action tabular-nums">{fmtTime(b.slotStart)}</td>
                    <td className="px-3 py-2.5 font-semibold text-foreground">{teacher?.name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{teacher?.room}</td>
                    <td className="px-3 py-2.5 text-foreground">
                      {b.childName} <span className="text-muted-foreground">· {classLabel(b.childClass, t)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-foreground">{b.parentName}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{b.phone ? formatPhone(b.phone) : t('a_walkIn')}</td>
                    <td className="px-3 py-2.5">
                      <StatusPill
                        status={b.status === 'done' ? 'done' : b.status === 'no_show' ? 'noShow' : 'taken'}
                        label={b.status === 'done' ? t('st_done') : b.status === 'no_show' ? t('st_noShow') : t('st_taken')}
                      />
                    </td>
                    <td className="px-3 py-2.5 font-mono font-semibold">
                      <button type="button" className="underline-offset-2 hover:underline" aria-label={`${b.code}: ${b.childName}`}>
                        {b.code}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      {open && <SlotSheet {...open} onClose={() => setOpen(null)} />}
    </>
  );
}
