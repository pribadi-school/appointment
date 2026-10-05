/** Builds the "Send schedule to my WhatsApp" message, in the chosen language. */
import { translate } from './i18n';
import { fmtDate, fmtRange } from './time';
import type { Booking, Lang, Settings, Teacher } from './types';

export function scheduleMessage(lang: Lang, bookings: Booking[], teachers: Teacher[], settings: Settings) {
  const t = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) => translate(lang, k, v);
  const byId = new Map(teachers.map((x) => [x.id, x]));
  const lines = [...bookings]
    .sort((a, b) => a.slotStart - b.slotStart)
    .map((b) => {
      const teacher = byId.get(b.teacherId);
      return t('wa_line', {
        time: fmtRange(b.slotStart, settings.slotMinutes),
        teacher: teacher?.name ?? '—',
        subject: teacher?.subject ? ` (${teacher.subject})` : '',
        room: teacher?.room ?? t('roomTbc'),
        child: b.childName ?? '',
        cls: b.childClass ?? '',
        code: b.code,
      });
    });
  return [
    t('wa_title'),
    t('school'),
    '',
    t('wa_intro', { date: fmtDate(settings.eventDate, lang) }),
    '',
    ...lines,
    '',
    t('wa_footer', { url: `${window.location.origin}/my` }),
  ].join('\n');
}

/** wa.me link that opens WhatsApp with the message, addressed to `phone`. */
export const waLink = (phone: string | null, text?: string) =>
  `https://wa.me/${phone ?? ''}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
