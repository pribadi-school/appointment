/** Shared data types used across the app. */

export type Lang = 'en' | 'id';

export type Settings = {
  eventDate: string; // "2026-12-19" (Asia/Jakarta calendar date)
  dayStart: string; // "08:30"
  dayEnd: string; // "12:30"
  slotMinutes: number; // 10
  bookingOpen: boolean;
};

export type Teacher = {
  id: string;
  name: string;
  subject: string | null;
  grades: number[]; // empty = every grade
  role: string | null;
  homeroomClass: string | null; // "8B"
  isLeadership: boolean;
  room: string | null;
  available: boolean;
  sortOrder: number;
};

/** Public information about a slot. No row = Available. */
export type PublicSlot = {
  teacherId: string;
  slotStart: number; // epoch ms
  status: 'taken' | 'done';
  label: string | null; // "8B – A."
};

export type ParentDetails = {
  parentName: string;
  childName: string;
  childClass: string;
  phone: string;
};

/** A booking with private details (teacher, admin and "my schedule" views). */
export type Booking = {
  id: string;
  code: string;
  teacherId: string;
  slotStart: number;
  kind: 'booking' | 'blocked';
  status: 'booked' | 'done' | 'no_show';
  parentName: string | null;
  childName: string | null;
  childClass: string | null;
  phone: string | null;
  note: string | null;
  lang: Lang;
  createdBy: 'parent' | 'admin';
  createdAt: number;
};

/** A time this parent (phone number) is already booked. sameChild = for the child being booked now. */
export type BusySlot = { slotStart: number; teacherId: string; sameChild: boolean };

export type Session = { token: string; expiresAt: number; teacherId?: string };

export const CLASSES = ['7A', '7B', '7C', '8A', '8B', '9A', '9B', '10A', '10B', '11A', '11B', '12A', '12B'] as const;

export const gradeOf = (cls: string) => parseInt(cls, 10);

/** Every error the server can return, mapped to friendly text in i18n.ts. */
export const ERROR_CODES = [
  'SLOT_TAKEN',
  'PARENT_BUSY',
  'ALREADY_BOOKED_TEACHER',
  'BOOKING_CLOSED',
  'SLOT_PASSED',
  'INVALID_SLOT',
  'TEACHER_UNAVAILABLE',
  'INVALID_INPUT',
  'INVALID_PHONE',
  'NOT_FOUND',
  'CANNOT_CANCEL',
  'LOCKED',
  'BAD_PASSWORD',
  'ADMIN_NOT_SET',
  'SESSION_EXPIRED',
  'SCHEDULE_CONFLICT',
  'NETWORK',
  'UNKNOWN',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export class AppError extends Error {
  code: ErrorCode;
  constructor(code: string) {
    const known = (ERROR_CODES as readonly string[]).includes(code) ? (code as ErrorCode) : 'UNKNOWN';
    super(known);
    this.code = known;
  }
}

export const errorCode = (e: unknown): ErrorCode => (e instanceof AppError ? e.code : 'UNKNOWN');
