/** Step 4: summary card + "Book now". Handles the "someone was faster" case. */
import { useState, type ReactNode } from 'react';
import { CalendarDays, Clock, MapPin, User } from 'lucide-react';
import { StickyBar } from '../../components/Header';
import { useToast } from '../../components/Toast';
import { Avatar, Button, Card, Notice } from '../../components/ui';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useLive } from '../../lib/live';
import { formatPhone, normalizePhone } from '../../lib/phone';
import { initials } from '../../lib/teachers';
import { fmtDate, fmtRange } from '../../lib/time';
import { errorCode, type ErrorCode } from '../../lib/types';
import type { Flow } from '../BookPage';

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 text-muted-foreground" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 text-[15px] font-semibold text-foreground">{children}</dd>
      </div>
    </div>
  );
}

export function ConfirmStep({ flow }: { flow: Flow }) {
  const { t, lang, errorText } = useI18n();
  const toast = useToast();
  const { teachers, settings, refreshSlots } = useLive();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const teacher = teachers.find((x) => x.id === flow.teacherId);
  if (!teacher || !settings || !flow.slotStart) return null;
  const d = flow.details;

  const book = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.book({ ...d, teacherId: teacher.id, slotStart: flow.slotStart!, lang });
      flow.setResult(res);
      navigator.vibrate?.(30);
      refreshSlots();
      flow.go('done', { replace: true });
    } catch (e) {
      const code = errorCode(e);
      // Slot problems: back to the time picker with fresh data.
      if (code === 'SLOT_TAKEN' || code === 'PARENT_BUSY' || code === 'SLOT_PASSED' || code === 'INVALID_SLOT') {
        toast(errorText(code), 'error');
        flow.setSlotStart(null);
        await refreshSlots();
        flow.refreshBusy();
        window.history.back();
      } else if (code === 'ALREADY_BOOKED_TEACHER' || code === 'TEACHER_UNAVAILABLE') {
        toast(errorText(code), 'error');
        flow.refreshBusy();
        flow.go('teacher', { replace: true });
      } else {
        setError(code);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border bg-linear-135 from-action-tint to-surface p-4">
          <Avatar text={initials(teacher.name)} size="lg" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{t('c_teacher')}</p>
            <p className="text-lg leading-snug font-bold text-foreground">{teacher.name}</p>
            {teacher.subject && <p className="text-sm text-muted-foreground">{teacher.subject}</p>}
          </div>
        </div>
        <dl className="divide-y divide-border px-4">
          <Row icon={<Clock className="size-[18px]" />} label={t('c_time')}>
            <span className="tabular-nums">{fmtRange(flow.slotStart, settings.slotMinutes)}</span>
          </Row>
          <Row icon={<CalendarDays className="size-[18px]" />} label={t('c_date')}>
            {fmtDate(settings.eventDate, lang)}
          </Row>
          <Row icon={<MapPin className="size-[18px]" />} label={t('c_room')}>
            {teacher.room ?? t('roomTbc')}
          </Row>
          <Row icon={<User className="size-[18px]" />} label={t('c_for')}>
            <span className="text-accent">{d.childName}</span> · {d.childClass}
            <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
              {d.parentName} · {formatPhone(normalizePhone(d.phone))}
            </span>
          </Row>
        </dl>
      </Card>

      <p className="mt-4 px-1 text-[13px] text-muted-foreground">{t('c_note')}</p>
      {error && (
        <div className="mt-4">
          <Notice tone="error">{errorText(error)}</Notice>
        </div>
      )}

      <StickyBar>
        <Button block loading={busy} onClick={book}>
          {busy ? t('c_booking') : t('c_bookNow')}
        </Button>
      </StickyBar>
    </>
  );
}
