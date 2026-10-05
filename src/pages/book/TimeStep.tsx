/** Step 3: slot chips for the chosen teacher. Taken slots animate in live. */
import { useEffect, useMemo, useRef } from 'react';
import { Check, MapPin } from 'lucide-react';
import { StickyBar } from '../../components/Header';
import { useToast } from '../../components/Toast';
import { Avatar, Button, Card, Notice, Skeleton, cx } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { useLive } from '../../lib/live';
import { useTeacherSlots, type SlotView } from '../../lib/slots';
import { initials } from '../../lib/teachers';
import { fmtTime, hourOf } from '../../lib/time';
import type { Flow } from '../BookPage';

type ChipState = 'available' | 'selected' | 'taken' | 'busy' | 'passed';

export function TimeStep({ flow }: { flow: Flow }) {
  const { t } = useI18n();
  const toast = useToast();
  const { teachers, loading } = useLive();
  const teacher = teachers.find((x) => x.id === flow.teacherId);
  const slots = useTeacherSlots(flow.teacherId);
  const autoPicked = useRef(false);

  // Times where this parent already sits with ANOTHER teacher.
  const busyAt = useMemo(
    () => new Set(flow.busy.filter((b) => b.teacherId !== flow.teacherId).map((b) => b.slotStart)),
    [flow.busy, flow.teacherId],
  );
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
        <Avatar text={initials(teacher.name)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-foreground">{teacher.name}</p>
          {teacher.subject && <p className="truncate text-[13px] text-muted-foreground">{teacher.subject}</p>}
          {teacher.room && (
            <p className="flex items-center gap-1 truncate text-[13px] font-semibold text-foreground">
              <MapPin className="size-3 shrink-0 text-muted-foreground" aria-hidden />
              {teacher.room}
            </p>
          )}
        </div>
        <button type="button" onClick={() => flow.go('teacher')} className="shrink-0 px-1 text-sm font-semibold text-action hover:underline">
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
            <p className="mb-2 text-xs font-bold tracking-wide text-muted-foreground">{hour}</p>
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
                      'relative flex h-14 flex-col items-center justify-center rounded-md text-center',
                      'transition-[background-color,box-shadow,transform,color] duration-250 ease-standard',
                      s.flashing && 'animate-slot-flash',
                      st === 'available' && disabled && 'cursor-not-allowed opacity-50',
                      st === 'available' &&
                        'bg-status-available-bg text-status-available-fg ring-1 ring-status-available-border shadow-e1 hover:-translate-y-0.5 hover:shadow-e2 active:scale-95',
                      st === 'selected' && 'bg-action text-on-primary shadow-e3 ring-2 ring-action',
                      (st === 'taken' || st === 'busy') && 'cursor-not-allowed bg-status-taken-bg text-status-taken-fg',
                      st === 'passed' && 'cursor-not-allowed bg-transparent text-muted-foreground/70 ring-1 ring-border',
                    )}
                  >
                    <span className={cx('text-[15px] font-bold tabular-nums', (st === 'taken' || st === 'passed') && 'line-through decoration-1')}>
                      {fmtTime(s.start)}
                    </span>
                    {st !== 'available' && (
                      <span className="mt-0.5 flex items-center gap-0.5 text-[10.5px] leading-none font-semibold">
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

      {busyAt.size > 0 && <p className="mt-4 text-[13px] text-muted-foreground">{t('time_busyHint')}</p>}

      <StickyBar>
        <Button block disabled={!flow.slotStart} onClick={() => flow.go('confirm')}>
          {flow.slotStart ? t('time_continue', { time: fmtTime(flow.slotStart) }) : t('time_pick')}
        </Button>
      </StickyBar>
    </>
  );
}
