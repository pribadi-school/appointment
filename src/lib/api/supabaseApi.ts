/**
 * Real backend: Supabase. Reads the three public tables and calls the
 * Postgres functions defined in supabase/migrations/0001_schema.sql.
 */
import { createClient } from '@supabase/supabase-js';
import { AppError, type Booking, type PublicSlot, type Settings, type Teacher } from '../types';
import { hhmm } from '../time';
import type { Api, LiveTopic } from './api';

type Row = Record<string, unknown>;

const toTeacher = (r: Row): Teacher => ({
  id: r.id as string,
  name: r.name as string,
  level: r.level === 'sd' ? 'sd' : 'smp_sma',
  slotCount: (r.slot_count as number | null) ?? null,
  subject: (r.subject as string) ?? null,
  grades: (r.grades as number[]) ?? [],
  role: (r.role as string) ?? null,
  homeroomClass: (r.homeroom_class as string) ?? null,
  isLeadership: Boolean(r.is_leadership),
  room: (r.room as string) ?? null,
  available: Boolean(r.available),
  sortOrder: (r.sort_order as number) ?? 0,
});

const toSettings = (r: Row): Settings => ({
  eventDate: r.event_date as string,
  dayStart: hhmm(r.day_start as string),
  dayEnd: hhmm(r.day_end as string),
  slotMinutes: r.slot_minutes as number,
  bookingOpen: Boolean(r.booking_open),
  sdDayStart: hhmm(r.sd_day_start as string),
  sdDayEnd: hhmm(r.sd_day_end as string),
  sdSlotMinutes: r.sd_slot_minutes as number,
});

const toBooking = (r: Row): Booking => ({
  ...(r as unknown as Booking),
  slotStart: Date.parse(r.slotStart as string),
  createdAt: Date.parse(r.createdAt as string),
});

/** Turn any Supabase/network error into a friendly AppError. */
function fail(error: { message?: string } | null | undefined): never {
  const msg = error?.message ?? '';
  if (/fetch|network|Failed to|timeout|Load failed/i.test(msg)) throw new AppError('NETWORK');
  throw new AppError(msg.trim());
}

export function createSupabaseApi(url: string, key: string): Api {
  const sb = createClient(url, key, { auth: { persistSession: false } });

  async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    let res;
    try {
      res = await sb.rpc(fn, args);
    } catch {
      throw new AppError('NETWORK');
    }
    if (res.error) fail(res.error);
    return res.data as T;
  }

  /** Login functions return {error} instead of raising (see SQL comments). */
  async function login(fn: string, args: Record<string, unknown>) {
    const r = await rpc<{ token?: string; expiresAt?: string; teacherId?: string; error?: string }>(fn, args);
    if (r.error || !r.token) throw new AppError(r.error ?? 'UNKNOWN');
    return { token: r.token, expiresAt: Date.parse(r.expiresAt!), teacherId: r.teacherId };
  }

  const iso = (ms: number) => new Date(ms).toISOString();

  return {
    mode: 'supabase',

    async getSettings() {
      const { data, error } = await sb.from('settings').select('*').eq('id', 1).single();
      if (error) fail(error);
      return toSettings(data);
    },

    async getTeachers() {
      const { data, error } = await sb.from('teachers').select('*').order('sort_order').order('name');
      if (error) fail(error);
      return (data ?? []).map(toTeacher);
    },

    async getSlots() {
      // Page through in case there are more than 1000 slots.
      const out: PublicSlot[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb.from('slot_status').select('*').range(from, from + 999);
        if (error) fail(error);
        for (const r of data ?? [])
          out.push({ teacherId: r.teacher_id, slotStart: Date.parse(r.slot_start), status: r.status, label: r.public_label });
        if (!data || data.length < 1000) return out;
      }
    },

    subscribe(onChange, onConnection) {
      const channel = sb.channel(`ptc-live-${Math.random().toString(36).slice(2)}`);
      const tables: [string, LiveTopic][] = [
        ['slot_status', 'slots'],
        ['teachers', 'teachers'],
        ['settings', 'settings'],
      ];
      for (const [table, topic] of tables)
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => onChange(topic));
      channel.subscribe((status) => onConnection(status === 'SUBSCRIBED'));
      return () => {
        sb.removeChannel(channel);
      };
    },

    book: (i) =>
      rpc('book_slot', {
        p_teacher_id: i.teacherId,
        p_slot_start: iso(i.slotStart),
        p_parent_name: i.parentName,
        p_child_name: i.childName,
        p_child_class: i.childClass,
        p_phone: i.phone,
        p_lang: i.lang,
      }),

    async busySlots(phone, childName) {
      const r = await rpc<{ slotStart: string; teacherId: string; sameChild: boolean }[]>('parent_busy_slots', {
        p_phone: phone,
        p_child_name: childName,
      });
      return r.map((b) => ({ ...b, slotStart: Date.parse(b.slotStart) }));
    },

    async parentBookings(phone, childName) {
      return (await rpc<Row[]>('parent_bookings', { p_phone: phone, p_child_name: childName })).map(toBooking);
    },

    parentCancel: (id, phone, childName) =>
      rpc('parent_cancel_booking', { p_booking_id: id, p_phone: phone, p_child_name: childName }),

    teacherLogin: (teacherId, pin) => login('teacher_login', { p_teacher_id: teacherId, p_pin: pin }),
    teacherSchedule: async (token) => (await rpc<Row[]>('teacher_schedule', { p_token: token })).map(toBooking),
    teacherSetStatus: (token, id, status) => rpc('teacher_set_status', { p_token: token, p_booking_id: id, p_status: status }),
    logout: (token) => rpc('logout', { p_token: token }),

    adminLogin: (password) => login('admin_login', { p_password: password }),
    adminBookings: async (token) => (await rpc<Row[]>('admin_bookings', { p_token: token })).map(toBooking),
    adminBook: (token, i) =>
      rpc('admin_book', {
        p_token: token,
        p_teacher_id: i.teacherId,
        p_slot_start: iso(i.slotStart),
        p_parent_name: i.parentName,
        p_child_name: i.childName,
        p_child_class: i.childClass,
        p_phone: i.phone,
        p_lang: i.lang,
      }),
    adminMove: (token, id, teacherId, slotStart) =>
      rpc('admin_move_booking', { p_token: token, p_booking_id: id, p_teacher_id: teacherId, p_slot_start: iso(slotStart) }),
    adminCancel: (token, id) => rpc('admin_cancel_booking', { p_token: token, p_booking_id: id }),
    adminSetStatus: (token, id, status) => rpc('admin_set_status', { p_token: token, p_booking_id: id, p_status: status }),
    adminBlock: (token, teacherId, slotStart, note) =>
      rpc('admin_block_slot', { p_token: token, p_teacher_id: teacherId, p_slot_start: iso(slotStart), p_note: note }),
    adminSaveTeacher: (token, t) => rpc('admin_save_teacher', { p_token: token, p_teacher: t }),
    adminSetRoomForSubject: (token, subject, room) =>
      rpc('admin_set_room_for_subject', { p_token: token, p_subject: subject, p_room: room }),
    adminDeleteTeacher: (token, id) => rpc('admin_delete_teacher', { p_token: token, p_teacher_id: id }),
    adminSaveSettings: (token, s) =>
      rpc('admin_save_settings', {
        p_token: token,
        p_event_date: s.eventDate,
        p_day_start: s.dayStart,
        p_day_end: s.dayEnd,
        p_slot_minutes: s.slotMinutes,
        p_booking_open: s.bookingOpen,
        p_sd_day_start: s.sdDayStart,
        p_sd_day_end: s.sdDayEnd,
        p_sd_slot_minutes: s.sdSlotMinutes,
      }),
    async adminMaintenance(token, password, action) {
      // Returns {error} instead of raising, like the login functions.
      const r = await rpc<{ count?: number; error?: string }>('admin_maintenance', {
        p_token: token,
        p_password: password,
        p_action: action,
      });
      if (r.error) throw new AppError(r.error);
      return r.count ?? 0;
    },
    async adminSetTeacherPin(token, password, pin) {
      // Returns {error} instead of raising, like admin_maintenance.
      const r = await rpc<{ ok?: boolean; error?: string }>('admin_set_teacher_pin', {
        p_token: token,
        p_password: password,
        p_pin: pin,
      });
      if (r.error) throw new AppError(r.error);
    },
  };
}
