/** Step 1: parent name, child name, class (bottom sheet) and WhatsApp number. */
import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { CalendarDays, ChevronDown, Clock } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { StickyBar } from '../../components/Header';
import { Button, Card, Field, FieldError, Notice, Skeleton, cx } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { useLive } from '../../lib/live';
import { normalizePhone } from '../../lib/phone';
import { classLabel } from '../../lib/teachers';
import { fmtDate, scheduleFor } from '../../lib/time';
import { classesFor, type ParentDetails } from '../../lib/types';
import type { Flow } from '../BookPage';

type Errors = Partial<Record<keyof ParentDetails, string>>;

export function DetailsStep({ flow }: { flow: Flow }) {
  const { t, lang } = useI18n();
  const { settings, loading, teachers } = useLive();
  const sch = settings ? scheduleFor(settings, flow.level) : null;
  const [form, setForm] = useState<ParentDetails>(flow.details);
  const [errors, setErrors] = useState<Errors>({});
  const [sheet, setSheet] = useState(false);
  const refs = {
    parentName: useRef<HTMLInputElement>(null),
    childName: useRef<HTMLInputElement>(null),
    childClass: useRef<HTMLButtonElement>(null),
    phone: useRef<HTMLInputElement>(null),
  };

  const set = (k: keyof ParentDetails, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Errors = {};
    if (form.parentName.trim().length < 2) errs.parentName = t('v_parentName');
    if (form.childName.trim().length < 2) errs.childName = t('v_childName');
    if (!form.childClass) errs.childClass = t('v_childClass');
    // SD: the class must have its homeroom teachers open for booking.
    else if (
      flow.level === 'sd' &&
      !loading &&
      !teachers.some((x) => x.level === 'sd' && x.available && x.homeroomClass === form.childClass)
    )
      errs.childClass = t('sd_noClass');
    if (!normalizePhone(form.phone)) errs.phone = t('v_phone');
    setErrors(errs);
    const first = (Object.keys(refs) as (keyof ParentDetails)[]).find((k) => errs[k]);
    if (first) {
      refs[first].current?.focus();
      return;
    }
    flow.setDetails({
      parentName: form.parentName.trim(),
      childName: form.childName.trim().replace(/\s+/g, ' '),
      childClass: form.childClass,
      phone: form.phone.trim(),
    });
    flow.go(flow.level === 'sd' ? 'time' : 'teacher');
  };

  const closed = settings && !settings.bookingOpen;

  return (
    <>
      {loading || !settings || !sch ? (
        <Skeleton className="mb-5 h-20 rounded-lg" />
      ) : (
        <Card className="mb-5 divide-y divide-border-strong">
          <p className="flex items-center gap-3 px-4 py-3 text-base font-semibold text-foreground">
            <CalendarDays className="size-5 shrink-0 text-action" aria-hidden />
            {fmtDate(settings.eventDate, lang)}
          </p>
          <p className="flex items-center gap-3 px-4 py-3 text-base text-foreground tabular-nums">
            <Clock className="size-5 shrink-0 text-action" aria-hidden />
            {sch.dayStart.replace(':', '.')} – {sch.dayEnd.replace(':', '.')}
            <span className="text-muted-foreground">· {t('minutes', { n: sch.slotMinutes })}</span>
          </p>
        </Card>
      )}

      {closed && (
        <div className="mb-5">
          <Notice tone="error">
            <p className="font-semibold">{t('bookingClosedTitle')}</p>
            <p className="mt-0.5">{t('bookingClosedBody')}</p>
            <Link to="/my" className="mt-2 inline-block font-semibold text-action underline underline-offset-2">
              {t('nav_mySchedule')}
            </Link>
          </Notice>
        </div>
      )}

      {flow.remembered && (
        <div className="mb-5">
          <Notice
            tone="success"
            action={
              <button
                type="button"
                onClick={() => {
                  flow.forget();
                  setForm({ parentName: '', childName: '', childClass: '', phone: '' });
                }}
                className="shrink-0 text-sm font-semibold text-action underline underline-offset-2"
              >
                {t('notYou')}
              </button>
            }
          >
            {t('welcomeBack')}
          </Notice>
        </div>
      )}

      {sch && !closed && (
        <p className="mb-5 text-base text-muted-foreground">
          {t(flow.level === 'sd' ? 'intro_sd' : 'intro', { minutes: sch.slotMinutes })}
        </p>
      )}

      <form id="details-form" onSubmit={submit} noValidate className="space-y-5">
        <Field
          ref={refs.parentName}
          label={t('f_parentName')}
          placeholder={t('f_parentNamePh')}
          autoComplete="name"
          value={form.parentName}
          onChange={(e) => set('parentName', e.target.value)}
          error={errors.parentName}
          maxLength={80}
        />
        <Field
          ref={refs.childName}
          label={t('f_childName')}
          placeholder={t('f_childNamePh')}
          autoComplete="off"
          value={form.childName}
          onChange={(e) => set('childName', e.target.value)}
          error={errors.childName}
          maxLength={80}
        />
        <div>
          <span id="class-label" className="mb-1.5 block text-sm font-semibold text-foreground">
            {t('f_childClass')}
          </span>
          <button
            ref={refs.childClass}
            type="button"
            onClick={() => setSheet(true)}
            aria-labelledby="class-label class-value"
            aria-haspopup="dialog"
            aria-invalid={errors.childClass ? true : undefined}
            className={cx(
              'flex h-12 w-full items-center justify-between rounded-md border bg-surface px-4 text-left text-base transition-colors duration-150',
              errors.childClass ? 'border-destructive' : 'border-border-strong hover:border-action',
            )}
          >
            <span id="class-value" className={form.childClass ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
              {form.childClass ? classLabel(form.childClass, t) : t('f_chooseClass')}
            </span>
            <ChevronDown className="size-5 text-muted-foreground" aria-hidden />
          </button>
          {errors.childClass && <FieldError>{errors.childClass}</FieldError>}
        </div>
        <Field
          ref={refs.phone}
          label={t('f_phone')}
          placeholder={t('f_phonePh')}
          hint={t('f_phoneHint')}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
          error={errors.phone}
          maxLength={20}
        />
      </form>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title={t('classSheetTitle')}>
        {(flow.level === 'sd'
          ? [{ title: t('sd'), grades: [1, 2, 3, 4, 5, 6] }]
          : [
              { title: t('smp'), grades: [7, 8, 9] },
              { title: t('sma'), grades: [10, 11, 12] },
            ]
        ).map((group) => (
          <div key={group.title} className="mb-4 last:mb-0">
            <p className="mb-2 text-sm font-semibold text-muted-foreground">{group.title}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {classesFor(flow.level).filter((c) => group.grades.includes(parseInt(c, 10))).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={form.childClass === c}
                  data-autofocus={form.childClass === c || undefined}
                  onClick={() => {
                    set('childClass', c);
                    setSheet(false);
                  }}
                  className={cx(
                    'h-12 rounded-md border text-base font-bold transition-colors duration-150',
                    form.childClass === c
                      ? 'border-action bg-action text-on-primary'
                      : 'border-border-strong bg-surface text-foreground hover:border-action hover:bg-action-tint',
                  )}
                >
                  {classLabel(c, t)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </BottomSheet>

      <StickyBar>
        <Button type="submit" form="details-form" block disabled={Boolean(closed)}>
          {t('continue')}
        </Button>
      </StickyBar>
    </>
  );
}
