/**
 * OFFLINE DEMO backend. Used automatically when no Supabase URL is set.
 * Data lives in this browser's localStorage and is shared live between tabs
 * (open the board in one tab and book in another to see real-time updates).
 *
 * It follows the same rules as the SQL functions (one parent per slot, one
 * slot per teacher per child, no two rooms at once), but it is NOT secure and
 * NOT shared between devices. Never use it for the real event.
 *
 * Demo admin password: "demo". Teachers sign in by picking their name.
 */
import { parseSeed } from '../../data/seedTeachers';
import { childKey, firstNameKey, normalizePhone } from '../phone';
import { jakartaTime, slotStarts } from '../time';
import { AppError, type Booking, type Settings, type Teacher } from '../types';
import { KEYS, load, save } from '../storage';
import type { Api, BookInput, LiveTopic } from './api';

type Db = {
  settings: Settings;
  teachers: Teacher[];
  bookings: Booking[];
  sessions: { token: string; role: 'admin' | 'teacher'; teacherId?: string; expiresAt: number }[];
  /** Shared teacher PIN; missing in demo data saved before PINs existed. */
  teacherPin?: string;
};

const DEMO_ADMIN_PASSWORD = 'demo';
const DEMO_TEACHER_PIN = '1234';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const uid = () => crypto.randomUUID();
const code = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * 32)]).join('');
const wait = (ms = 220 + Math.random() * 200) => new Promise((r) => setTimeout(r, ms));
const isTest = typeof navigator !== 'undefined' && navigator.webdriver;

const DEMO_NAMES = ['Aisyah', 'Bima', 'Citra', 'Dimas', 'Elena', 'Farhan', 'Gita', 'Hafiz', 'Intan', 'Jovan', 'Kirana', 'Raka', 'Salma', 'Yusuf'];

function freshDb(): Db {
  const teachers: Teacher[] = parseSeed().map((t) => ({ ...t, id: uid() }));
  const settings: Settings = { eventDate: '2026-12-19', dayStart: '08:30', dayEnd: '12:30', slotMinutes: 10, bookingOpen: true };
  const db: Db = { settings, teachers, bookings: [], sessions: [] };
  // Pre-fill some bookings so the board looks like a real morning.
  if (!isTest) {
    const starts = slotStarts(settings);
    let n = 0;
    for (const t of teachers.filter((t) => t.available)) {
      for (const s of starts) {
        if (Math.random() < 0.32) {
          const child = DEMO_NAMES[n % DEMO_NAMES.length];
          db.bookings.push(demoBooking(t.id, s, child, n));
          n++;
        }
      }
    }
  }
  return db;
}

function demoBooking(teacherId: string, slotStart: number, child: string, n: number): Booking {
  const cls = ['7A', '7B', '8A', '8B', '9A', '9B', '10A', '10B', '11A', '11B', '12A', '12B'][n % 12];
  return {
    id: uid(),
    code: code(),
    teacherId,
    slotStart,
    kind: 'booking',
    status: 'booked',
    parentName: `Parent of ${child}`,
    childName: `${child} (demo ${n})`,
    childClass: cls,
    phone: `62811000${String(1000 + n).slice(-4)}`,
    note: null,
    lang: 'en',
    createdBy: 'parent',
    createdAt: Date.now(),
  };
}

function read(): Db {
  const db = load<Db | null>(KEYS.demoDb, null);
  if (db) return db;
  const fresh = freshDb();
  save(KEYS.demoDb, fresh);
  return fresh;
}

const listeners = new Set<(t: LiveTopic) => void>();
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ptc-demo') : null;
channel?.addEventListener('message', (e) => listeners.forEach((l) => l(e.data as LiveTopic)));

function write(db: Db, topic: LiveTopic) {
  save(KEYS.demoDb, db);
  listeners.forEach((l) => l(topic));
  channel?.postMessage(topic);
}

function isValidSlot(db: Db, slot: number) {
  return slotStarts(db.settings).includes(slot);
}

function session(db: Db, token: string, role: 'admin' | 'teacher') {
  const s = db.sessions.find((x) => x.token === token && x.role === role && x.expiresAt > Date.now());
  if (!s) throw new AppError('SESSION_EXPIRED');
  return s;
}

/** Same checks, same order, as private.insert_booking() in SQL. */
function insertBooking(db: Db, i: BookInput, by: 'parent' | 'admin'): Booking {
  const parentName = i.parentName.trim();
  const childName = i.childName.trim().replace(/\s+/g, ' ');
  if (parentName.length < 2 || childName.length < 2 || !/^(7|8|9|10|11|12)[A-Z]$/.test(i.childClass)) {
    throw new AppError('INVALID_INPUT');
  }
  let phone: string | null = null;
  if (!(by === 'admin' && !i.phone.trim())) {
    phone = normalizePhone(i.phone);
    if (!phone) throw new AppError('INVALID_PHONE');
  }
  if (!db.teachers.some((t) => t.id === i.teacherId && t.available)) throw new AppError('TEACHER_UNAVAILABLE');
  if (!isValidSlot(db, i.slotStart)) throw new AppError('INVALID_SLOT');
  if (db.bookings.some((b) => b.teacherId === i.teacherId && b.slotStart === i.slotStart)) throw new AppError('SLOT_TAKEN');
  if (phone) {
    const mine = db.bookings.filter((b) => b.kind === 'booking' && b.phone === phone);
    if (mine.some((b) => b.slotStart === i.slotStart)) throw new AppError('PARENT_BUSY');
    if (mine.some((b) => b.teacherId === i.teacherId && childKey(b.childName ?? '') === childKey(childName))) {
      throw new AppError('ALREADY_BOOKED_TEACHER');
    }
  }
  const b: Booking = {
    id: uid(),
    code: code(),
    teacherId: i.teacherId,
    slotStart: i.slotStart,
    kind: 'booking',
    status: 'booked',
    parentName,
    childName,
    childClass: i.childClass,
    phone,
    note: null,
    lang: i.lang,
    createdBy: by,
    createdAt: Date.now(),
  };
  db.bookings.push(b);
  return b;
}

function familyBookings(db: Db, phoneRaw: string, childName: string) {
  const phone = normalizePhone(phoneRaw);
  if (!phone) throw new AppError('INVALID_PHONE');
  const first = firstNameKey(childName);
  const mine = db.bookings.filter((b) => b.kind === 'booking' && b.phone === phone);
  if (!first || !mine.some((b) => firstNameKey(b.childName ?? '') === first)) return { phone, list: [] as Booking[] };
  return { phone, list: mine.sort((a, b) => a.slotStart - b.slotStart) };
}

function newSession(db: Db, role: 'admin' | 'teacher', teacherId?: string) {
  const s = { token: uid(), role, teacherId, expiresAt: Date.now() + 12 * 3600_000 };
  db.sessions.push(s);
  save(KEYS.demoDb, db);
  return { token: s.token, expiresAt: s.expiresAt, teacherId };
}

// A gentle "other parents are booking" simulation so live updates are visible
// in the demo. Disabled in automated tests.
let simTimer: ReturnType<typeof setInterval> | null = null;
function startSimulation() {
  if (simTimer || isTest) return;
  simTimer = setInterval(() => {
    if (document.hidden) return;
    const db = read();
    const free: [string, number][] = [];
    for (const t of db.teachers.filter((t) => t.available))
      for (const s of slotStarts(db.settings))
        if (s > Date.now() && !db.bookings.some((b) => b.teacherId === t.id && b.slotStart === s)) free.push([t.id, s]);
    if (!free.length) return;
    const [teacherId, slot] = free[Math.floor(Math.random() * free.length)];
    const n = db.bookings.length;
    db.bookings.push(demoBooking(teacherId, slot, DEMO_NAMES[n % DEMO_NAMES.length], n));
    write(db, 'slots');
  }, 35_000);
}

export function createDemoApi(): Api {
  return {
    mode: 'demo',

    async getSettings() {
      await wait(150);
      return read().settings;
    },
    async getTeachers() {
      await wait(150);
      return [...read().teachers].sort((a, b) => a.sortOrder - b.sortOrder);
    },
    async getSlots() {
      await wait(150);
      return read().bookings.map((b) => ({
        teacherId: b.teacherId,
        slotStart: b.slotStart,
        status: b.status === 'booked' ? 'taken' : 'done',
        label: b.kind === 'booking' ? `${b.childClass} – ${(b.childName ?? '?')[0].toUpperCase()}.` : null,
      }));
    },
    subscribe(onChange, onConnection) {
      listeners.add(onChange);
      const onStorage = (e: StorageEvent) => e.key === KEYS.demoDb && onChange('slots');
      window.addEventListener('storage', onStorage);
      setTimeout(() => onConnection(true), 300);
      startSimulation();
      return () => {
        listeners.delete(onChange);
        window.removeEventListener('storage', onStorage);
      };
    },

    async book(i) {
      await wait();
      const db = read();
      if (!db.settings.bookingOpen) throw new AppError('BOOKING_CLOSED');
      if (i.slotStart <= Date.now()) throw new AppError('SLOT_PASSED');
      const b = insertBooking(db, i, 'parent');
      write(db, 'slots');
      return { id: b.id, code: b.code };
    },
    async busySlots(phoneRaw, childName) {
      await wait(120);
      const phone = normalizePhone(phoneRaw);
      return read()
        .bookings.filter((b) => b.kind === 'booking' && phone && b.phone === phone)
        .map((b) => ({ slotStart: b.slotStart, teacherId: b.teacherId, sameChild: childKey(b.childName ?? '') === childKey(childName) }));
    },
    async parentBookings(phone, childName) {
      await wait();
      return familyBookings(read(), phone, childName).list;
    },
    async parentCancel(id, phoneRaw, childName) {
      await wait();
      const db = read();
      const { list } = familyBookings(db, phoneRaw, childName);
      const b = list.find((x) => x.id === id);
      if (!b) throw new AppError('NOT_FOUND');
      if (b.status !== 'booked' || b.slotStart <= Date.now()) throw new AppError('CANNOT_CANCEL');
      db.bookings = db.bookings.filter((x) => x.id !== id);
      write(db, 'slots');
    },

    async teacherLogin(teacherId, pin) {
      await wait();
      const db = read();
      if (!db.teachers.some((t) => t.id === teacherId)) throw new AppError('NOT_FOUND');
      if (pin !== (db.teacherPin ?? DEMO_TEACHER_PIN)) throw new AppError('BAD_PIN');
      return newSession(db, 'teacher', teacherId);
    },
    async teacherSchedule(token) {
      await wait(150);
      const db = read();
      const s = session(db, token, 'teacher');
      return db.bookings.filter((b) => b.teacherId === s.teacherId).sort((a, b) => a.slotStart - b.slotStart);
    },
    async teacherSetStatus(token, id, status) {
      await wait(150);
      const db = read();
      const s = session(db, token, 'teacher');
      const b = db.bookings.find((x) => x.id === id && x.teacherId === s.teacherId && x.kind === 'booking');
      if (!b) throw new AppError('NOT_FOUND');
      b.status = status;
      write(db, 'slots');
    },
    async logout(token) {
      const db = read();
      db.sessions = db.sessions.filter((s) => s.token !== token);
      save(KEYS.demoDb, db);
    },

    async adminLogin(password) {
      await wait();
      if (password !== DEMO_ADMIN_PASSWORD) throw new AppError('BAD_PASSWORD');
      return newSession(read(), 'admin');
    },
    async adminBookings(token) {
      await wait(150);
      const db = read();
      session(db, token, 'admin');
      return [...db.bookings].sort((a, b) => a.slotStart - b.slotStart);
    },
    async adminBook(token, i) {
      await wait();
      const db = read();
      session(db, token, 'admin');
      const b = insertBooking(db, i, 'admin');
      write(db, 'slots');
      return { id: b.id, code: b.code };
    },
    async adminMove(token, id, teacherId, slotStart) {
      await wait();
      const db = read();
      session(db, token, 'admin');
      if (!isValidSlot(db, slotStart)) throw new AppError('INVALID_SLOT');
      const b = db.bookings.find((x) => x.id === id);
      if (!b) throw new AppError('NOT_FOUND');
      if (db.bookings.some((x) => x.id !== id && x.teacherId === teacherId && x.slotStart === slotStart)) throw new AppError('SLOT_TAKEN');
      if (b.phone && db.bookings.some((x) => x.id !== id && x.kind === 'booking' && x.phone === b.phone && x.slotStart === slotStart))
        throw new AppError('PARENT_BUSY');
      b.teacherId = teacherId;
      b.slotStart = slotStart;
      write(db, 'slots');
    },
    async adminCancel(token, id) {
      await wait();
      const db = read();
      session(db, token, 'admin');
      db.bookings = db.bookings.filter((b) => b.id !== id);
      write(db, 'slots');
    },
    async adminSetStatus(token, id, status) {
      await wait(150);
      const db = read();
      session(db, token, 'admin');
      const b = db.bookings.find((x) => x.id === id && x.kind === 'booking');
      if (b) b.status = status;
      write(db, 'slots');
    },
    async adminBlock(token, teacherId, slotStart, note) {
      await wait();
      const db = read();
      session(db, token, 'admin');
      if (!isValidSlot(db, slotStart)) throw new AppError('INVALID_SLOT');
      if (db.bookings.some((b) => b.teacherId === teacherId && b.slotStart === slotStart)) throw new AppError('SLOT_TAKEN');
      db.bookings.push({
        id: uid(), code: code(), teacherId, slotStart, kind: 'blocked', status: 'booked', parentName: null, childName: null,
        childClass: null, phone: null, note: note.trim() || null, lang: 'en', createdBy: 'admin', createdAt: Date.now(),
      });
      write(db, 'slots');
    },
    async adminSaveTeacher(token, t) {
      await wait();
      const db = read();
      session(db, token, 'admin');
      if (t.name.trim().length < 2) throw new AppError('INVALID_INPUT');
      const clean: Omit<Teacher, 'id' | 'sortOrder'> = {
        name: t.name.trim(),
        subject: t.subject?.trim() || null,
        grades: t.grades ?? [],
        role: t.role?.trim() || null,
        homeroomClass: t.homeroomClass || null,
        isLeadership: Boolean(t.isLeadership),
        room: t.room?.trim() || null,
        available: t.available ?? true,
      };
      if (t.id) {
        const existing = db.teachers.find((x) => x.id === t.id);
        if (!existing) throw new AppError('NOT_FOUND');
        Object.assign(existing, clean);
        write(db, 'teachers');
        return existing.id;
      }
      const id = uid();
      db.teachers.push({ ...clean, id, sortOrder: Math.max(0, ...db.teachers.map((x) => x.sortOrder)) + 1 });
      write(db, 'teachers');
      return id;
    },
    async adminSetRoomForSubject(token, subject, room) {
      await wait();
      const db = read();
      session(db, token, 'admin');
      const list = db.teachers.filter((t) => (t.subject ?? '') === (subject ?? ''));
      list.forEach((t) => (t.room = room.trim() || null));
      write(db, 'teachers');
      return list.length;
    },
    async adminDeleteTeacher(token, id) {
      await wait();
      const db = read();
      session(db, token, 'admin');
      db.teachers = db.teachers.filter((t) => t.id !== id);
      db.bookings = db.bookings.filter((b) => b.teacherId !== id);
      write(db, 'teachers');
      write(db, 'slots');
    },
    async adminSaveSettings(token, s) {
      await wait();
      const db = read();
      session(db, token, 'admin');
      if (s.dayStart >= s.dayEnd || s.slotMinutes < 5 || s.slotMinutes > 60) throw new AppError('INVALID_INPUT');
      const shift = jakartaTime(s.eventDate, '00:00') - jakartaTime(db.settings.eventDate, '00:00');
      const next = { ...db, settings: s, bookings: db.bookings.map((b) => ({ ...b, slotStart: b.slotStart + shift })) };
      const valid = new Set(slotStarts(s));
      if (next.bookings.some((b) => !valid.has(b.slotStart))) throw new AppError('SCHEDULE_CONFLICT');
      write(next, 'settings');
      write(next, 'slots');
    },
    async adminMaintenance(token, password, action) {
      await wait();
      const db = read();
      session(db, token, 'admin');
      if (password !== DEMO_ADMIN_PASSWORD) throw new AppError('BAD_PASSWORD');
      let count: number;
      if (action === 'clear_bookings') {
        count = db.bookings.length;
        db.bookings = [];
        write(db, 'slots');
      } else {
        const keep = (s: Db['sessions'][number]) => (action === 'sign_out_teachers' ? s.role !== 'teacher' : s.token === token);
        count = db.sessions.filter((s) => !keep(s)).length;
        db.sessions = db.sessions.filter(keep);
        save(KEYS.demoDb, db);
      }
      return count;
    },
    async adminSetTeacherPin(token, password, pin) {
      await wait();
      const db = read();
      session(db, token, 'admin');
      if (password !== DEMO_ADMIN_PASSWORD) throw new AppError('BAD_PASSWORD');
      if (!/^[0-9]{4,10}$/.test(pin)) throw new AppError('INVALID_PIN');
      db.teacherPin = pin;
      db.sessions = db.sessions.filter((s) => s.role !== 'teacher');
      save(KEYS.demoDb, db);
    },
  };
}

/** Wipe the demo data (Admin → Settings → "Reset demo data"). */
export function resetDemo() {
  save(KEYS.demoDb, null);
  read();
  listeners.forEach((l) => {
    l('settings');
    l('teachers');
    l('slots');
  });
  channel?.postMessage('slots');
}
