/** "Booked!" — success animation, booking code and next actions. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { CalendarCheck, MessageCircle, Plus } from 'lucide-react';
import { Button, Card, buttonClass } from '../../components/ui';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useLive } from '../../lib/live';
import { normalizePhone } from '../../lib/phone';
import { fmtTime } from '../../lib/time';
import { scheduleMessage, waLink } from '../../lib/whatsapp';
import type { Flow } from '../BookPage';

/** Animated check in a brand-gradient badge, with a small burst. */
export function SuccessMark() {
  const dots = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return { dx: `${Math.cos(a) * 64}px`, dy: `${Math.sin(a) * 64}px`, accent: i % 3 === 0 };
  });
  return (
    <div className="relative mx-auto size-24" aria-hidden>
      {dots.map((d, i) => (
        <span
          key={i}
          className={`burst-dot absolute top-1/2 left-1/2 -mt-1 -ml-1 size-2 rounded-full ${d.accent ? 'bg-accent' : 'bg-primary'}`}
          style={{ '--dx': d.dx, '--dy': d.dy } as React.CSSProperties}
        />
      ))}
      <div className="relative flex size-24 animate-pop items-center justify-center rounded-[28px] bg-linear-135 from-gradient-start to-gradient-end shadow-e4">
        <svg viewBox="0 0 24 24" className="size-12" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
          <path className="check-draw text-on-primary" d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </div>
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
    <div className="pt-6 text-center">
      <SuccessMark />
      <h1 className="mt-6 text-3xl font-extrabold">{t('done_title')}</h1>
      <p className="mx-auto mt-2 max-w-sm text-[15px] text-muted-foreground" role="status">
        {t('done_sub', { time: fmtTime(slot), room: teacher.room ?? t('roomTbc') })}
      </p>

      <Card className="mx-auto mt-6 max-w-sm p-5 text-left">
        <p className="text-sm font-bold text-foreground">{teacher.name}</p>
        <p className="text-[13px] text-muted-foreground">
          {teacher.subject ?? ''} · <span className="font-semibold text-accent">{flow.details.childName}</span> ({flow.details.childClass})
        </p>
        <div className="mt-4 flex items-end justify-between border-t border-border pt-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t('done_code')}</p>
            <p className="font-mono text-2xl font-bold tracking-[0.2em] text-foreground" data-testid="booking-code">
              {flow.result.code}
            </p>
          </div>
          <p className="text-2xl font-extrabold text-action tabular-nums">{fmtTime(slot)}</p>
        </div>
      </Card>

      <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3">
        <Button
          icon={<Plus className="size-5" aria-hidden />}
          block
          onClick={() => {
            // Keeps parent details; back to "Choose a teacher".
            flow.go('teacher');
            flow.setSlotStart(null);
            flow.setTeacherId(null);
          }}
        >
          {t('done_another')}
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
