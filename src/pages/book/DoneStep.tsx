/** "Booked!" — success animation, booking code and next actions. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { CalendarCheck, MessageCircle, Plus } from 'lucide-react';
import { Button, Card, buttonClass } from '../../components/ui';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useLive } from '../../lib/live';
import { normalizePhone } from '../../lib/phone';
import { classLabel } from '../../lib/teachers';
import { fmtTime } from '../../lib/time';
import { scheduleMessage, waLink } from '../../lib/whatsapp';
import type { Flow } from '../BookPage';

/** Flat success mark: solid brand circle, the check draws in once (static under reduced motion). */
export function SuccessMark() {
  return (
    <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-action" aria-hidden>
      <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
        <path className="check-draw text-on-primary" d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </div>
  );
}

export function DoneStep({ flow }: { flow: Flow }) {
  const { t, lang } = useI18n();
  const { teachers, settings } = useLive();
  const [wa, setWa] = useState<string | null>(null);
  const teacher = teachers.find((x) => x.id === flow.teacherId);
  const slot = flow.slotStart;

  // Prepare the WhatsApp message with the parent's whole schedule.
  useEffect(() => {
    if (!settings) return;
    api.parentBookings(flow.details.phone, flow.details.childName).then(
      (list) => setWa(waLink(normalizePhone(flow.details.phone), scheduleMessage(lang, list, teachers, settings))),
      () => setWa(null),
    );
  }, [flow.details, lang, teachers, settings]);

  if (!teacher || !slot || !flow.result) return null;

  return (
    <div className="pt-4 text-center">
      <SuccessMark />
      <h1 className="mt-4 text-2xl font-bold">{t('done_title')}</h1>
      <p className="mx-auto mt-2 max-w-sm text-base text-muted-foreground" role="status">
        {t('done_sub', { time: fmtTime(slot), room: teacher.room ?? t('roomTbc') })}
      </p>

      <Card className="mx-auto mt-6 max-w-sm p-4 text-left">
        <p className="text-base leading-snug font-semibold text-foreground">{teacher.name}</p>
        <p className="text-sm text-muted-foreground">
          {teacher.subject ?? t('sd_teachers')} · <span className="font-semibold text-foreground">{flow.details.childName}</span> (
          {classLabel(flow.details.childClass, t)})
        </p>
        <div className="mt-4 flex items-end justify-between border-t border-border-strong pt-4">
          <div>
            <p className="text-sm text-muted-foreground">{t('done_code')}</p>
            <p className="font-mono text-2xl font-bold tracking-[0.2em] text-foreground" data-testid="booking-code">
              {flow.result.code}
            </p>
          </div>
          <p className="text-2xl font-bold text-action tabular-nums">{fmtTime(slot)}</p>
        </div>
      </Card>

      <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3">
        <Button
          icon={<Plus className="size-5" aria-hidden />}
          block
          onClick={() => {
            // Keeps parent details; back to "Choose a teacher" (SD: to the details, for another child/class).
            flow.go(flow.level === 'sd' ? 'details' : 'teacher');
            flow.setSlotStart(null);
            flow.setTeacherId(null);
          }}
        >
          {t(flow.level === 'sd' ? 'sd_another' : 'done_another')}
        </Button>
        <a
          href={wa ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!wa}
          className={buttonClass('secondary', 'md', true)}
        >
          <MessageCircle className="size-5" aria-hidden />
          {t('done_wa')}
        </a>
        <Link to="/my" className={buttonClass('ghost', 'md', true)}>
          <CalendarCheck className="size-5" aria-hidden />
          {t('done_view')}
        </Link>
      </div>
    </div>
  );
}
