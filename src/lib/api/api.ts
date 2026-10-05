/**
 * Everything the app can ask the server. Two implementations:
 *   - supabaseApi.ts: the real thing (Postgres functions + Realtime)
 *   - demoApi.ts:     offline demo that runs in the browser, used when no
 *                     Supabase URL is configured
 */
import type {
  Booking,
  BusySlot,
  GeneratedPin,
  Lang,
  ParentDetails,
  PublicSlot,
  Session,
  Settings,
  Teacher,
} from '../types';

export type LiveTopic = 'slots' | 'teachers' | 'settings';

export type BookInput = ParentDetails & { teacherId: string; slotStart: number; lang: Lang };

export interface Api {
  mode: 'supabase' | 'demo';

  // Public data
  getSettings(): Promise<Settings>;
  getTeachers(): Promise<Teacher[]>;
  getSlots(): Promise<PublicSlot[]>;
  /** Calls onChange whenever public data changes. Returns an unsubscribe fn. */
  subscribe(onChange: (topic: LiveTopic) => void, onConnection: (live: boolean) => void): () => void;

  // Parents
  book(input: BookInput): Promise<{ id: string; code: string }>;
  busySlots(phone: string, childName: string): Promise<BusySlot[]>;
  parentBookings(phone: string, childName: string): Promise<Booking[]>;
  parentCancel(bookingId: string, phone: string, childName: string): Promise<void>;

  // Teachers
  teacherLogin(teacherId: string, pin: string): Promise<Session>;
  teacherSchedule(token: string): Promise<Booking[]>;
  teacherSetStatus(token: string, bookingId: string, status: Booking['status']): Promise<void>;
  logout(token: string): Promise<void>;

  // Admin
  adminLogin(password: string): Promise<Session>;
  adminBookings(token: string): Promise<Booking[]>;
  adminBook(token: string, input: BookInput): Promise<{ id: string; code: string }>;
  adminMove(token: string, bookingId: string, teacherId: string, slotStart: number): Promise<void>;
  adminCancel(token: string, bookingId: string): Promise<void>;
  adminSetStatus(token: string, bookingId: string, status: Booking['status']): Promise<void>;
  adminBlock(token: string, teacherId: string, slotStart: number, note: string): Promise<void>;
  adminSaveTeacher(token: string, teacher: Partial<Teacher> & { name: string }): Promise<string>;
  adminSetRoomForSubject(token: string, subject: string | null, room: string): Promise<number>;
  adminDeleteTeacher(token: string, teacherId: string): Promise<void>;
  adminSetPin(token: string, teacherId: string, pin: string): Promise<void>;
  adminGeneratePins(token: string, onlyMissing: boolean): Promise<GeneratedPin[]>;
  adminPinStatus(token: string): Promise<string[]>;
  adminSaveSettings(token: string, settings: Settings): Promise<void>;
}
