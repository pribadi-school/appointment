/** Admin dashboard: key numbers, open/close switch and the full-detail grid (one per level). */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Ban, Check, UserX } from 'lucide-react';
import { Card, Skeleton, Switch, cx } from '../../components/ui';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useLive, useNow } from '../../lib/live';
import { classLabel } from '../../lib/teachers';
import { currentSlotIndex, fmtTime, scheduleFor, slotStarts } from '../../lib/time';
import type { Booking, Level, Teacher } from '../../lib/types';
import { useAdmin } from './AdminPage';
import { SlotSheet } from './SlotSheet';

const LEVELS: Level[] = ['sd', 'smp_sma'];

export function Dashboard() {
  const { t } = useI18n();
  const { settings, teachers } = useLive();
  const { token, bookings, run } = useAdmin();
  const [open, setOpen] = useState<{ teacherId: string; slotStart: number } | null>(null);

  const map = useMemo(() => new Map((bookings ?? []).map((b) => [`${b.teacherId}|${b.slotStart}`, b])), [bookings]);
  const sorted = useMemo(() => [...teachers].sort((a, b) => Number(b.available) - Number(a.available) || a.name.localeCompare(b.name)), [teachers]);

  if (!settings || !bookings) return <Skeleton className="h-[60vh] rounded-lg" />;

  const real = bookings.filter((b) => b.kind === 'booking');
  const totalSlots = teachers.filter((x) => x.available).reduce((n, x) => n + slotStarts(scheduleFor(settings, x.level)).length, 0);
  const stats = [
    { label: t('a_stat_booked'), value: real.length },
    { label: t('a_stat_done'), value: real.filter((b) => b.status === 'done').length },
    { label: t('a_stat_noShow'), value: real.filter((b) => b.status === 'no_show').length },
    { label: t('a_stat_free'), value: Math.max(0, totalSlots - bookings.length) },
  ];

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-2xl font-extrabold text-foreground tabular-nums">{s.value}</p>
            <p className="text-xs font-semibold text-muted-foreground">{s.label}</p>
          </Card>
        ))}
        <Card className="col-span-2 flex items-center justify-between gap-3 p-4 lg:col-span-1">
          <div>
            <p className={cx('text-sm font-bold', settings.bookingOpen ? 'text-foreground' : 'text-destructive')}>
              {settings.bookingOpen ? t('a_bookingOpen') : t('a_bookingClosed')}
            </p>
            <p className="text-xs text-muted-foreground">{t('a_s_open')}</p>
          </div>
          <Switch
            checked={settings.bookingOpen}
            label={settings.bookingOpen ? t('a_closeBooking') : t('a_openBooking')}
            onChange={(v) => run(() => api.adminSaveSettings(token, { ...settings, bookingOpen: v }), v ? t('a_bookingOpen') : t('a_bookingClosed'))}
          />
        </Card>
      </div>

      <p className="mb-3 text-sm text-muted-foreground">{t('a_cellHint')}</p>
      <div className="space-y-6">
        {LEVELS.map((level) => {
          const list = sorted.filter((x) => x.level === level);
          if (!list.length) return null;
          const sch = scheduleFor(settings, level);
          return (
            <LevelGrid
              key={level}
              title={t(level === 'sd' ? 'lvl_sd' : 'lvl_smp')}
              teachers={list}
              starts={slotStarts(sch)}
              minutes={sch.slotMinutes}
              map={map}
              onOpen={(teacherId, slotStart) => setOpen({ teacherId, slotStart })}
            />
          );
        })}
      </div>

      {open && <SlotSheet teacherId={open.teacherId} slotStart={open.slotStart} onClose={() => setOpen(null)} />}
    </>
  );
}

function LevelGrid({
  title,
  teachers,
  starts,
  minutes,
  map,
  onOpen,
}: {
  title: string;
  teachers: Teacher[];
  starts: number[];
  minutes: number;
  map: Map<string, Booking>;
  onOpen: (teacherId: string, slotStart: number) => void;
}) {
  const { t } = useI18n();
  const { now } = useNow(15_000);
  const scroller = useRef<HTMLDivElement>(null);
  const current = currentSlotIndex(starts, minutes, now);

  useEffect(() => {
    const col = scroller.current?.querySelector<HTMLElement>(`[data-col="${current}"]`);
    const sticky = scroller.current?.querySelector<HTMLElement>('thead th')?.offsetWidth ?? 0;
    if (col && scroller.current) scroller.current.scrollTo({ left: Math.max(0, col.offsetLeft - sticky - col.offsetWidth) });
  }, [current]);

  const cell = (b: Booking | undefined) => {
    if (!b) return null;
    if (b.kind === 'blocked') return <Ban className="size-4" aria-hidden />;
    const tag = `${b.childClass}·${(b.childName ?? '?')[0]}`;
    return (
      <span className="flex items-center gap-0.5 text-[10.5px] font-bold">
        {b.status === 'done' && <Check className="size-3" aria-hidden />}
        {b.status === 'no_show' && <UserX className="size-3" aria-hidden />}
        {tag}
      </span>
    );
  };

  return (
    <section aria-label={title}>
      <h2 className="mb-2 text-base font-bold text-foreground">
        {title} <span className="text-xs font-semibold text-muted-foreground">· {t('minutes', { n: minutes })}</span>
      </h2>
      <Card className="overflow-hidden">
        <div ref={scroller} className="max-h-[calc(100dvh-300px)] min-h-40 overflow-auto overscroll-contain">
          <table className="border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-20 min-w-40 border-b border-border bg-surface px-3 py-2 text-left text-xs font-bold text-muted-foreground sm:min-w-60">
                  {t('a_col_teacher')}
                </th>
                {starts.map((s, i) => (
                  <th
                    key={s}
                    data-col={i}
                    className={cx(
                      'sticky top-0 z-10 border-b border-border px-0.5 py-2 text-center text-xs font-bold tabular-nums',
                      i === current ? 'bg-action text-on-primary' : 'bg-surface text-muted-foreground',
                    )}
                  >
                    {fmtTime(s)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => (
                <tr key={teacher.id} className={cx(!teacher.available && 'opacity-50')}>
                  <th scope="row" className="sticky left-0 z-10 max-w-40 border-b border-border bg-surface px-3 py-1.5 text-left font-normal sm:max-w-60">
                    <span className="block truncate text-[13px] font-bold text-foreground">{teacher.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {teacher.level === 'sd' && `${classLabel(teacher.homeroomClass, t)} · `}
                      {teacher.available ? (teacher.room ?? '—') : t('a_t_unavailable')}
                    </span>
                  </th>
                  {starts.map((s, i) => {
                    const b = map.get(`${teacher.id}|${s}`);
                    return (
                      <td key={s} className={cx('border-b border-border p-0.5', i === current && 'bg-action-tint')}>
                        <button
                          type="button"
                          onClick={() => onOpen(teacher.id, s)}
                          aria-label={`${teacher.name} ${fmtTime(s)}: ${
                            b ? (b.kind === 'blocked' ? t('st_blocked') : `${b.childName} ${b.childClass}`) : t('st_available')
                          }`}
                          className={cx(
                            'flex h-9 w-14 items-center justify-center rounded-[8px] transition-[box-shadow,transform] duration-200 hover:shadow-e2 hover:-translate-y-px',
                            !b && 'bg-status-available-bg ring-1 ring-inset ring-status-available-border',
                            b?.kind === 'blocked' && 'bg-status-taken-bg text-muted-foreground',
                            b?.kind === 'booking' && b.status === 'booked' && 'bg-action-tint text-action',
                            b?.kind === 'booking' && b.status === 'done' && 'bg-status-done-bg text-status-done-fg ring-1 ring-inset ring-border-strong',
                            b?.kind === 'booking' && b.status === 'no_show' && 'bg-accent-tint text-foreground',
                          )}
                        >
                          {cell(b)}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
