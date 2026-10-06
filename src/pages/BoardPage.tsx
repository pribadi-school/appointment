/**
 * Public live board for the venue TV (and phones). No login, no names:
 * only Available / Taken / In progress / Done, plus class + initial in
 * the "By room" view.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock, LayoutGrid, MapPin, Search, Users } from 'lucide-react';
import { Header } from '../components/Header';
import { Card, PulseDot, Segmented, Skeleton, cx } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { slotKey, useLive, useNow } from '../lib/live';
import { currentSlotIndex, fmtDate, fmtRange, fmtTime, jakartaDate, levelGridStarts, scheduleFor, slotStarts, slotState, teacherSchedule, type SlotState } from '../lib/time';
import type { Level, Teacher } from '../lib/types';

type View = 'grid' | 'rooms';

const CELL: Record<SlotState, string> = {
  available: 'bg-status-available-bg ring-1 ring-inset ring-status-available-border',
  taken: 'bg-status-taken-bg',
  inProgress: 'bg-status-progress-bg ring-2 ring-inset ring-gradient-end',
  done: 'bg-status-done-bg ring-1 ring-inset ring-border-strong text-status-done-fg',
  passed: 'bg-transparent ring-1 ring-inset ring-border',
};

function CellMark({ state }: { state: SlotState }) {
  if (state === 'taken') return <span className="size-2.5 rounded-full bg-muted-foreground" aria-hidden />;
  if (state === 'inProgress') return <PulseDot className="!size-2.5" />;
  if (state === 'done') return <Check className="size-4" aria-hidden />;
  return null;
}

export default function BoardPage() {
  const { t, lang } = useI18n();
  const { settings, teachers, loading } = useLive();
  const { now, simulated } = useNow(10_000);
  const [view, setView] = useState<View>(() => (window.innerWidth < 640 ? 'rooms' : 'grid'));
  const [query, setQuery] = useState('');

  const visible = useMemo(
    () =>
      teachers
        .filter((x) => x.available)
        .filter((x) => !query || `${x.name} ${x.room ?? ''} ${x.subject ?? ''}`.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [teachers, query],
  );

  // One time grid per level: SD and SMP–SMA have different times and slot lengths.
  const sections = useMemo(
    () =>
      settings
        ? LEVELS.map((level) => {
            const sch = scheduleFor(settings, level);
            const list = visible.filter((x) => x.level === level);
            // Stretched to the class/teacher with the most slots.
            return { level, starts: levelGridStarts(settings, level, list), minutes: sch.slotMinutes, teachers: list };
          })
        : [],
    [settings, visible],
  );

  const statusLabel = useStatusLabels();

  // Header line: Now / Starts at / Ended / event day (across both levels)
  const spans = sections.flatMap((x) => x.starts.map((s) => [s, s + x.minutes * 60_000]));
  const first = Math.min(...spans.map(([s]) => s));
  const last = Math.max(...spans.map(([, e]) => e));
  let nowText: string;
  if (!settings) nowText = '';
  else if (jakartaDate(now) !== settings.eventDate) nowText = t('b_eventDay', { date: fmtDate(settings.eventDate, lang) });
  else if (spans.length && now < first) nowText = t('b_startsAt', { time: fmtTime(first) });
  else if (!spans.length || now >= last) nowText = t('b_ended');
  else nowText = t('b_now', { range: fmtTime(now) });

  return (
    <div className="flex min-h-dvh flex-col">
      <Header title={t('b_title')} wide />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-4 pb-6 xl:px-8">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Card className="flex items-center gap-3 px-4 py-3">
            <span className="inline-flex size-10 items-center justify-center rounded-md bg-action-tint text-action" aria-hidden>
              <Clock className="size-5" />
            </span>
            <div>
              <p className="text-lg leading-tight font-extrabold text-foreground tabular-nums xl:text-2xl" aria-live="polite">
                {nowText}
              </p>
              <p className="text-xs text-muted-foreground">
                {simulated ? t('b_simulated', { time: fmtTime(now) }) : settings && jakartaDate(now) === settings.eventDate ? fmtDate(settings.eventDate, lang) : t('liveHelp')}
              </p>
            </div>
          </Card>
          <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
            <div className="relative min-w-40 flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('search')}
                aria-label={t('t_searchPh')}
                className="h-11 w-full rounded-md border border-border-strong bg-surface pr-3 pl-9 text-base outline-none focus:border-action focus:ring-1 focus:ring-action sm:w-52"
              />
            </div>
            <Segmented
              label={t('b_title')}
              value={view}
              onChange={setView}
              options={[
                { value: 'grid', label: <span className="inline-flex items-center gap-1.5"><LayoutGrid className="size-4" aria-hidden />{t('b_grid')}</span> },
                { value: 'rooms', label: <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" aria-hidden />{t('b_byRoom')}</span> },
              ]}
            />
          </div>
        </div>

        {/* Legend */}
        <ul aria-label={t('b_legend')} className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-muted-foreground">
          {(['available', 'taken', 'inProgress', 'done'] as const).map((s) => (
            <li key={s} className="inline-flex items-center gap-1.5">
              <span className={cx('inline-flex size-5 items-center justify-center rounded-[6px]', CELL[s])} aria-hidden>
                <CellMark state={s} />
              </span>
              {statusLabel[s]}
            </li>
          ))}
        </ul>

        {loading || !settings ? (
          <Skeleton className="h-[60vh] rounded-lg" />
        ) : view === 'grid' ? (
          <div className="space-y-6">
            {sections
              .filter((x) => x.teachers.length)
              .map((x) => (
                <GridSection key={x.level} title={t(x.level === 'sd' ? 'lvl_sd' : 'lvl_smp')} teachers={x.teachers} starts={x.starts} minutes={x.minutes} now={now} />
              ))}
          </div>
        ) : (
          <RoomsView teachers={visible} now={now} />
        )}
      </main>
    </div>
  );
}

const LEVELS: Level[] = ['sd', 'smp_sma'];

function useStatusLabels(): Record<SlotState, string> {
  const { t } = useI18n();
  return {
    available: t('st_available'),
    taken: t('st_taken'),
    inProgress: t('st_inProgress'),
    done: t('st_done'),
    passed: t('st_passed'),
  };
}

/** One level's grid: teachers down, that level's slot times across. */
function GridSection({ title, teachers, starts, minutes, now }: { title: string; teachers: Teacher[]; starts: number[]; minutes: number; now: number }) {
  const { t } = useI18n();
  const { slots, flashing, settings } = useLive();
  const statusLabel = useStatusLabels();
  const scroller = useRef<HTMLDivElement>(null);
  const current = currentSlotIndex(starts, minutes, now);

  // Auto-scroll the grid so the current time column is in view.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const idx = current >= 0 ? current : starts.findIndex((s) => s > now);
    const col = el.querySelector<HTMLElement>(`[data-col="${idx}"]`);
    const sticky = el.querySelector<HTMLElement>('thead th')?.offsetWidth ?? 0;
    // Keep one earlier slot visible to the right of the sticky name column.
    if (col) el.scrollTo({ left: Math.max(0, col.offsetLeft - sticky - col.offsetWidth), behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, starts.length]);

  const state = (teacherId: string, start: number) => slotState(slots.get(slotKey(teacherId, start)), start, minutes, now);

  return (
    <section aria-label={title}>
      <h2 className="mb-2 flex flex-wrap items-baseline gap-x-2 text-base font-bold text-foreground">
        {title}
        <span className="text-xs font-semibold text-muted-foreground tabular-nums">
          {current >= 0 ? t('b_now', { range: fmtRange(starts[current], minutes) }) : t('minutes', { n: minutes })}
        </span>
      </h2>
      <Card className="overflow-hidden">
        <div ref={scroller} className="max-h-[calc(100dvh-230px)] overflow-auto overscroll-contain">
          <table className="border-separate border-spacing-0 text-sm">
            <caption className="sr-only">{`${t('b_title')} · ${title}`}</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky top-0 left-0 z-20 min-w-36 border-b border-border bg-surface px-3 py-2 text-left text-xs font-bold text-muted-foreground sm:min-w-56">
                  {t('b_teacher')}
                </th>
                {starts.map((s, i) => (
                  <th
                    key={s}
                    scope="col"
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
              {teachers.map((teacher) => {
                // Slots past this teacher's own count are not on their schedule.
                const own = new Set(settings ? slotStarts(teacherSchedule(settings, teacher)) : starts);
                return (
                <tr key={teacher.id}>
                  <th scope="row" className="sticky left-0 z-10 max-w-36 border-b border-border bg-surface px-3 py-1.5 text-left font-normal sm:max-w-56">
                    <span className="block truncate text-sm font-bold text-foreground xl:text-sm">{teacher.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{teacher.room ?? '-'}</span>
                  </th>
                  {starts.map((s, i) => {
                    if (!own.has(s)) return <td key={s} className="border-b border-border p-0.5" aria-hidden />;
                    const st = state(teacher.id, s);
                    return (
                      <td key={s} className={cx('border-b border-border p-0.5', i === current && 'bg-action-tint')}>
                        <span
                          role="img"
                          aria-label={`${teacher.name}, ${fmtTime(s)}: ${statusLabel[st]}`}
                          title={`${fmtTime(s)} · ${statusLabel[st]}`}
                          className={cx(
                            'flex h-9 w-12 items-center justify-center rounded-[8px] transition-colors duration-300 xl:h-10 xl:w-14',
                            CELL[st],
                            flashing.has(slotKey(teacher.id, s)) && 'animate-slot-flash',
                          )}
                        >
                          <CellMark state={st} />
                        </span>
                      </td>
                    );
                  })}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

function RoomsView({ teachers, now }: { teachers: Teacher[]; now: number }) {
  const { t } = useI18n();
  const { slots, flashing, settings } = useLive();
  const rooms = useMemo(() => {
    const m = new Map<string, Teacher[]>();
    for (const x of teachers) m.set(x.room ?? '', [...(m.get(x.room ?? '') ?? []), x]);
    return [...m.entries()].sort(([a], [b]) => (a ? (b ? a.localeCompare(b) : -1) : 1));
  }, [teachers]);

  return (
    <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rooms.map(([room, list]) => (
        <Card key={room} as="section" className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold xl:text-lg">
            <MapPin className="size-4 text-action" aria-hidden />
            {room || t('b_noRoom')}
          </h2>
          <ul className="divide-y divide-border">
            {list.map((teacher) => {
              // Each teacher on their own level's grid.
              const sch = teacherSchedule(settings!, teacher);
              const starts = slotStarts(sch);
              const current = currentSlotIndex(starts, sch.slotMinutes, now);
              const nowEntry = current >= 0 ? slots.get(slotKey(teacher.id, starts[current])) : undefined;
              const nextStart = starts.find((s) => s > now && slots.get(slotKey(teacher.id, s))?.status === 'taken');
              const nextEntry = nextStart ? slots.get(slotKey(teacher.id, nextStart)) : undefined;
              const flash = current >= 0 && flashing.has(slotKey(teacher.id, starts[current]));
              return (
                <li key={teacher.id} className="py-2.5">
                  <p className="truncate text-sm font-bold text-foreground">{teacher.name}</p>
                  <div className="mt-1.5 grid grid-cols-2 gap-2 text-sm">
                    <div className={cx('rounded-md px-2.5 py-1.5', nowEntry ? 'bg-status-progress-bg' : 'bg-surface-page', flash && 'animate-slot-flash')}>
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
                        {nowEntry && nowEntry.status === 'taken' && <PulseDot />}
                        {t('b_now_label')}
                      </p>
                      <p className="font-bold text-foreground">
                        {nowEntry ? (nowEntry.label ?? t('st_taken')) : t('b_nobody')}
                        {nowEntry?.status === 'done' && <Check className="ml-1 inline size-3.5 text-muted-foreground" aria-label={t('st_done')} />}
                      </p>
                    </div>
                    <div className="rounded-md bg-surface-page px-2.5 py-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">{t('b_next')}</p>
                      <p className="truncate font-bold text-foreground">
                        {nextStart ? (
                          <>
                            <span className="text-action tabular-nums">{fmtTime(nextStart)}</span> · {nextEntry?.label ?? t('st_taken')}
                          </>
                        ) : (
                          <span className="font-medium text-muted-foreground">{t('b_noMore')}</span>
                        )}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
      {!rooms.length && (
        <p className="col-span-full py-10 text-center text-muted-foreground">
          <Users className="mx-auto mb-2 size-6" aria-hidden />
          {t('t_noResults', { q: '' })}
        </p>
      )}
    </div>
  );
}
