/**
 * Parent booking flow, one per level:
 *   SMP–SMA: Details → Teacher → Time → Confirm → Booked!
 *   SD:      Details → Time → Confirm → Booked!  (the class decides the
 *            teachers: each SD class is one record, its two homeroom teachers)
 * The current step lives in the URL (?step=time) so the phone's back button
 * goes back one step, like a native app.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { Header } from '../components/Header';
import { cx } from '../components/ui';
import { api } from '../lib/api';
import { useI18n, type MessageKey } from '../lib/i18n';
import { useLive } from '../lib/live';
import { KEYS, load, save } from '../lib/storage';
import { levelOfClass, type BusySlot, type Level, type ParentDetails } from '../lib/types';
import { DetailsStep } from './book/DetailsStep';
import { TeacherStep } from './book/TeacherStep';
import { TimeStep } from './book/TimeStep';
import { ConfirmStep } from './book/ConfirmStep';
import { DoneStep } from './book/DoneStep';

export type Step = 'details' | 'teacher' | 'time' | 'confirm' | 'done';
const STEPS_BY_LEVEL: Record<Level, Step[]> = {
  smp_sma: ['details', 'teacher', 'time', 'confirm'],
  sd: ['details', 'time', 'confirm'],
};
const STEP_LABEL: Record<Exclude<Step, 'done'>, MessageKey> = {
  details: 'step_details',
  teacher: 'step_teacher',
  time: 'step_time',
  confirm: 'step_confirm',
};

const EMPTY: ParentDetails = { parentName: '', childName: '', childClass: '', phone: '' };

export type Flow = {
  level: Level;
  details: ParentDetails;
  setDetails: (d: ParentDetails) => void;
  teacherId: string | null;
  setTeacherId: (id: string | null) => void;
  slotStart: number | null;
  setSlotStart: (s: number | null) => void;
  busy: BusySlot[];
  refreshBusy: () => void;
  result: { id: string; code: string } | null;
  setResult: (r: { id: string; code: string } | null) => void;
  go: (s: Step, opts?: { replace?: boolean }) => void;
  remembered: boolean;
  forget: () => void;
};

export function BookPage({ level }: { level: Level }) {
  const { t } = useI18n();
  const { version, teachers, loading } = useLive();
  const [params, setParams] = useSearchParams();
  // Remembered details; a class from the other level is dropped (name and number are kept).
  const stored = useRef(load<ParentDetails | null>(KEYS.parent, null));
  const [details, setDetailsState] = useState<ParentDetails>(() =>
    stored.current ? { ...stored.current, childClass: levelOfClass(stored.current.childClass) === level ? stored.current.childClass : '' } : EMPTY,
  );
  const [remembered, setRemembered] = useState(Boolean(stored.current?.phone));
  const [chosenTeacher, setTeacherId] = useState<string | null>(null);
  // SD: the class's record is the "teacher".
  const sdClass = level === 'sd' ? teachers.find((x) => x.level === 'sd' && x.available && x.homeroomClass === details.childClass) : undefined;
  const teacherId = level === 'sd' ? (sdClass?.id ?? null) : chosenTeacher;
  const STEPS = STEPS_BY_LEVEL[level];
  const [slotStart, setSlotStart] = useState<number | null>(null);
  const [busy, setBusy] = useState<BusySlot[]>([]);
  const [result, setResult] = useState<{ id: string; code: string } | null>(null);
  const heading = useRef<HTMLDivElement>(null);

  const raw = params.get('step') as Step | null;
  const step: Step = raw && [...STEPS, 'done'].includes(raw) ? raw : 'details';

  const go = useCallback(
    (s: Step, opts?: { replace?: boolean }) => setParams(s === 'details' ? {} : { step: s }, { replace: opts?.replace }),
    [setParams],
  );

  const detailsComplete = Boolean(details.parentName && details.childName && details.childClass && details.phone);

  // Deep link / refresh into a later step without the data → go back.
  useEffect(() => {
    if (step === 'details' || loading) return;
    if (!detailsComplete) go('details', { replace: true });
    else if ((step === 'time' || step === 'confirm') && !teacherId) go(level === 'sd' ? 'details' : 'teacher', { replace: true });
    else if (step === 'confirm' && !slotStart) go('time', { replace: true });
    else if (step === 'done' && !result) go(level === 'sd' ? 'details' : 'teacher', { replace: true });
  }, [step, detailsComplete, teacherId, slotStart, result, go, level, loading]);

  const setDetails = (d: ParentDetails) => {
    setDetailsState(d);
    save(KEYS.parent, d);
  };

  const refreshBusy = useCallback(() => {
    if (!details.phone) return;
    api.busySlots(details.phone, details.childName).then(setBusy, () => {});
  }, [details.phone, details.childName]);

  // Keep "you're already booked at this time" up to date (also after cancels).
  useEffect(() => {
    if (step === 'teacher' || step === 'time') refreshBusy();
  }, [step, version, refreshBusy]);

  // Move focus to the step title for screen readers & keyboard users.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [step]);

  const flow: Flow = {
    level,
    details,
    setDetails,
    teacherId,
    setTeacherId,
    slotStart,
    setSlotStart,
    busy,
    refreshBusy,
    result,
    setResult,
    go,
    remembered,
    forget: () => {
      save(KEYS.parent, null);
      setDetailsState(EMPTY);
      setRemembered(false);
      setBusy([]);
    },
  };

  const index = STEPS.indexOf(step as (typeof STEPS)[number]);

  return (
    <div className="min-h-dvh">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pt-4 pb-36">
        {step === 'details' && (
          // First page of the level: the app name + chosen level as the page title.
          <div className="mb-6 pt-1">
            <Link to="/" className="-ml-1 mb-2 inline-flex items-center gap-1 rounded-full px-1 text-sm font-semibold text-action hover:underline">
              <ChevronLeft className="size-4" aria-hidden />
              {t('changeLevel')}
            </Link>
            <h1 className="text-[28px] leading-tight font-extrabold text-foreground">{t('appName')}</h1>
            <p className="mt-1 text-[15px] font-medium text-muted-foreground">
              {t(level === 'sd' ? 'lvl_sd' : 'lvl_smp')} · {t(level === 'sd' ? 'lvl_sdSub' : 'lvl_smpSub')}
            </p>
          </div>
        )}
        {step !== 'done' && (
          <div ref={heading} tabIndex={-1} className="mb-5 outline-none">
            <div className="flex items-center gap-2">
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => window.history.back()}
                  aria-label={t('back')}
                  className="-ml-2 inline-flex size-10 items-center justify-center rounded-full text-foreground hover:bg-surface"
                >
                  <ChevronLeft className="size-6" aria-hidden />
                </button>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {t('stepOf', { n: index + 1, total: STEPS.length })}
                </p>
                {step === 'details' ? (
                  <h2 className="text-2xl font-bold">{t(STEP_LABEL.details)}</h2>
                ) : (
                  <h1 className="text-2xl font-bold">{t(STEP_LABEL[step as Exclude<Step, 'done'>])}</h1>
                )}
              </div>
            </div>
            <div
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={STEPS.length}
              aria-valuenow={index + 1}
              aria-valuetext={`${t('stepOf', { n: index + 1, total: STEPS.length })}: ${t(STEP_LABEL[step as Exclude<Step, 'done'>])}`}
              className={cx('mt-3 grid gap-1.5', STEPS.length === 3 ? 'grid-cols-3' : 'grid-cols-4')}
            >
              {STEPS.map((s, i) => (
                <span key={s} className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  <span
                    className={cx(
                      'block h-full origin-left rounded-full bg-linear-90 from-gradient-start to-primary transition-transform duration-300 ease-out-cubic',
                      i <= index ? 'scale-x-100' : 'scale-x-0',
                    )}
                  />
                </span>
              ))}
            </div>
          </div>
        )}
        {step === 'done' && <div ref={heading} tabIndex={-1} className="outline-none" />}

        <div key={step} className="animate-step-in">
          {step === 'details' && <DetailsStep flow={flow} />}
          {step === 'teacher' && level === 'smp_sma' && detailsComplete && <TeacherStep flow={flow} />}
          {step === 'time' && teacherId && <TimeStep flow={flow} />}
          {step === 'confirm' && teacherId && slotStart && <ConfirmStep flow={flow} />}
          {step === 'done' && result && <DoneStep flow={flow} />}
        </div>
      </main>
    </div>
  );
}
