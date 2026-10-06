/**
 * Time helpers. The whole app runs on Asia/Jakarta time (WIB, UTC+7, no
 * daylight saving), whatever timezone the visitor's phone is set to.
 */
import type { Lang, Level, Settings } from './types';

export const TZ = 'Asia/Jakarta';
const MINUTE = 60_000;

/** "08:30:00" → "08:30" */
export const hhmm = (t: string) => t.slice(0, 5);

/** Epoch ms for a wall-clock time on the event day in Jakarta. */
export const jakartaTime = (date: string, time: string) => Date.parse(`${date}T${hhmm(time)}:00+07:00`);

/** One level's day: SMP–SMA and SD have their own times and slot lengths. */
export type Schedule = { eventDate: string; dayStart: string; dayEnd: string; slotMinutes: number };

export function scheduleFor(s: Settings, level: Level): Schedule {
  return level === 'sd'
    ? { eventDate: s.eventDate, dayStart: s.sdDayStart, dayEnd: s.sdDayEnd, slotMinutes: s.sdSlotMinutes }
    : { eventDate: s.eventDate, dayStart: s.dayStart, dayEnd: s.dayEnd, slotMinutes: s.slotMinutes };
}

/** Slot length for a level. */
export const minutesFor = (s: Settings, level: Level) => scheduleFor(s, level).slotMinutes;

/** Do [a, a+aMin) and [b, b+bMin) overlap? Used for "one room at a time". */
export const overlaps = (a: number, aMin: number, b: number, bMin: number) => a < b + bMin * MINUTE && b < a + aMin * MINUTE;

/** All slot start times (epoch ms) for one level's day. */
export function slotStarts(s: Schedule): number[] {
  const start = jakartaTime(s.eventDate, s.dayStart);
  const end = jakartaTime(s.eventDate, s.dayEnd);
  const out: number[] = [];
  for (let t = start; t + s.slotMinutes * MINUTE <= end; t += s.slotMinutes * MINUTE) out.push(t);
  return out;
}

const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** 09.10 (Indonesian style, used in both languages) */
export const fmtTime = (ms: number) => timeFmt.format(ms).replace(':', '.');

/** 09.10 – 09.20 */
export const fmtRange = (ms: number, minutes: number) => `${fmtTime(ms)} – ${fmtTime(ms + minutes * MINUTE)}`;

/** Saturday, 17 October 2026 / Sabtu, 17 Oktober 2026 */
export function fmtDate(date: string, lang: Lang, opts: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-GB', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...opts,
  }).format(jakartaTime(date, '12:00'));
}

/** Jakarta calendar date of an instant, "2026-10-17" */
export const jakartaDate = (ms: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);

/** Hour bucket label for grouping slot chips, e.g. "08.00" */
export const hourOf = (ms: number) => `${fmtTime(ms).slice(0, 2)}.00`;

export type SlotState = 'available' | 'taken' | 'inProgress' | 'done' | 'passed';

/**
 * What a slot is right now, from public data + the clock.
 * Booked slots become "In progress" during their time and "Done" afterwards
 * (or earlier, when the teacher taps Done).
 */
export function slotState(entry: { status: 'taken' | 'done' } | undefined, start: number, minutes: number, now: number): SlotState {
  const end = start + minutes * MINUTE;
  if (entry?.status === 'done') return 'done';
  if (entry) {
    if (now >= end) return 'done';
    if (now >= start) return 'inProgress';
    return 'taken';
  }
  return now >= start ? 'passed' : 'available';
}

/** Index of the slot running at `now`, or -1. */
export function currentSlotIndex(starts: number[], minutes: number, now: number) {
  return starts.findIndex((s) => now >= s && now < s + minutes * MINUTE);
}

/**
 * Optional clock override for rehearsals and demos: add ?now=09:12 to the URL
 * to see the board/teacher view as if it were 09.12 on the event day.
 */
export function clockOverride(eventDate: string | undefined): number | null {
  if (typeof window === 'undefined' || !eventDate) return null;
  const v = new URLSearchParams(window.location.search).get('now');
  if (!v) return null;
  if (/^\d{1,2}[:.]\d{2}$/.test(v)) return jakartaTime(eventDate, v.replace('.', ':').padStart(5, '0'));
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}
