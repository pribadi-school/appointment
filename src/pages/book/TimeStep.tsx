/** Step 3: slot chips for the chosen teacher. Taken slots animate in live. */
import { useEffect, useMemo, useRef } from 'react';
import { Check, MapPin } from 'lucide-react';
import { StickyBar } from '../../components/Header';
import { useToast } from '../../components/Toast';
import { Avatar, Button, Card, Notice, Skeleton, cx } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { useLive } from '../../lib/live';
import { useTeacherSlots, type SlotView } from '../../lib/slots';
import { avatarText, classLabel } from '../../lib/teachers';
import { fmtTime, hourOf, minutesFor, overlaps } from '../../lib/time';
import type { Flow } from '../BookPage';

type ChipState = 'available' | 'selected' | 'taken' | 'busy' | 'passed';

export function TimeStep({ flow }: { flow: Flow }) {
  const { t } = useI18n();
  const toast = useToast();
  const { teachers, settings, loading } = useLive();
  const teacher = teachers.find((x) => x.id === flow.teacherId);
  const slots = useTeacherSlots(flow.teacherId);
  const autoPicked = useRef(false);
  const sd = flow.level === 'sd';

  // Times that overlap one this parent already has with ANOTHER teacher.
  // Slot lengths differ between levels (SD 15 min, SMP–SMA 10 min), so any overlap counts.
  const busyAt = useMemo(() => {
    const out = new Set<number>();
    if (!settings || !teacher) return out;
    const level = new Map(teachers.map((x) => [x.id, x.level]));
    const mine = minutesFor(settings, teacher.level);
    const others = flow.busy.filter((b) => b.teacherId !== flow.teacherId);
    for (const s of slots)
      if (others.some((b) => overlaps(s.start, mine, b.slotStart, minutesFor(settings, level.get(b.teacherId) ?? 'smp_sma')))) out.add(s.start);
    return out;
  }, [flow.busy, flow.teacherId, slots, settings, teacher, teachers]);
  const alreadyWithTeacher = flow.busy.find((b) => b.teacherId === flow.teacherId && b.sameChild);

  const chipState = (s: SlotView): ChipState => {
    if (s.state === 'passed' || s.state === 'done' || s.state === 'inProgress') return s.state === 'passed' ? 'passed' : 'taken';
    if (s.state === 'taken') return 'taken';
    if (busyAt.has(s.start)) return 'busy';
    return flow.slotStart === s.start ? 'selected' : 'available';
  };

  const bookable = slots.filter((s) => s.state === 'available' && !busyAt.has(s.start));

  // Smart default: preselect the earliest free time (once).
  useEffect(() => {
    if (autoPicked.current || flow.slotStart || alreadyWithTeacher || !bookable.length) return;
    autoPicked.current = true;
    flow.setSlotStart(bookable[0].start);
  }, [bookable, flow, alreadyWithTeacher]);

  // If someone else books the selected time, unselect and say so.
  useEffect(() => {
    if (!flow.slotStart) return;
    const s = slots.find((x) => x.start === flow.slotStart);
    if (s && (s.state !== 'available' || busyAt.has(s.start))) {
      toast(t('time_justTaken', { time: fmtTime(s.start) }), 'error');
      flow.setSlotStart(null);
    }
  }, [slots, busyAt, flow, toast, t]);

  const byHour = useMemo(() => {
    const m = new Map<string, SlotView[]>();
    for (const s of slots) m.set(hourOf(s.start), [...(m.get(hourOf(s.start)) ?? []), s]);
    return [...m.entries()];
  }, [slots]);

  if (loading || !teacher) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 rounded-lg" />
        <div className="grid grid-cols-3 gap-2 min-[400px]:grid-cols-4">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  const label = (st: ChipState) =>
    st === 'taken' ? t('st_taken') : st === 'busy' ? t('st_youreBooked') : st === 'passed' ? t('st_passed') : st === 'selected' ? t('st_selected') : t('st_available');

  return (
    <>
      <Card className="mb-5 flex items-center gap-3 p-3.5">
        <Avatar text={avatarText(teacher)} />
        <div className="min-w-0 flex-1">
          {sd && <p className="text-xs font-semibold text-muted-foreground">{t('sd_teachers')} · {classLabel(teacher.homeroomClass, t)}</p>}
          <p className={cx('text-base font-bold text-foreground', !sd && 'truncate')}>{teacher.name}</p>
          {teacher.subject && <p className="truncate text-sm text-muted-foreground">{teacher.subject}</p>}
          {teacher.room && (
            <p className="flex items-center gap-1 truncate text-sm font-semibold text-foreground">
              <MapPin className="size-3 shrink-0 text-muted-foreground" aria-hidden />
              {teacher.room}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => flow.go(sd ? 'details' : 'teacher')}
          className="-mr-1 inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-sm font-semibold text-action transition-colors duration-150 hover:bg-action-tint"
        >
          {t('t_change')}
        </button>
      </Card>

      {alreadyWithTeacher ? (
        <Notice tone="info">{t('time_alreadyBooked', { child: flow.details.childName, time: fmtTime(alreadyWithTeacher.slotStart) })}</Notice>
      ) : !bookable.length ? (
        <Notice tone="info">{t('time_none')}</Notice>
      ) : null}

      <div className="mt-4 space-y-5" role="group" aria-label={t('time_heading')}>
        {byHour.map(([hour, list]) => (
          <div key={hour}>
            <p className="mb-2 text-sm font-semibold text-muted-foreground tabular-nums">{hour}</p>
            <div className="grid grid-cols-3 gap-2 min-[400px]:grid-cols-4 sm:grid-cols-6">
              {list.map((s) => {
                const st = chipState(s);
                const disabled = Boolean(alreadyWithTeacher) || (st !== 'available' && st !== 'selected');
                return (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={st === 'selected'}
                    aria-disabled={disabled || undefined}
                    aria-label={`${fmtTime(s.start)}, ${label(st)}`}
                    onClick={() => !disabled && flow.setSlotStart(s.start)}
                    className={cx(
                      'relative flex h-14 flex-col items-center justify-center rounded-md border text-center',
                      'transition-[background-color,border-color,color] duration-150 ease-standard',
                      s.flashing && 'animate-slot-flash',
                      st === 'available' && disabled && 'cursor-not-allowed opacity-50',
                      st === 'available' &&
                        'border-status-available-border bg-status-available-bg text-status-available-fg hover:border-action hover:bg-action-tint',
                      st === 'selected' && 'border-action bg-action text-on-primary',
                      (st === 'taken' || st === 'busy') && 'cursor-not-allowed border-transparent bg-status-taken-bg text-status-taken-fg',
                      st === 'passed' && 'cursor-not-allowed border-border bg-transparent text-muted-foreground',
                    )}
                  >
                    <span className={cx('text-base font-semibold tabular-nums', (st === 'taken' || st === 'passed') && 'line-through decoration-1')}>
                      {fmtTime(s.start)}
                    </span>
                    {st !== 'available' && (
                      <span className="mt-1 flex items-center gap-0.5 text-xs leading-none font-medium">
                        {st === 'selected' && <Check className="size-3" aria-hidden />}
                        {label(st)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {busyAt.size > 0 && <p className="mt-5 text-sm text-muted-foreground">{t('time_busyHint')}</p>}

      <StickyBar onBack={() => window.history.back()}>
        <Button block disabled={!flow.slotStart} onClick={() => flow.go('confirm')}>
          {flow.slotStart ? t('time_continue', { time: fmtTime(flow.slotStart) }) : t('time_pick')}
        </Button>
      </StickyBar>
    </>
  );
}
