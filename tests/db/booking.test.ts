/**
 * Database-level guarantees. These run against a real PostgreSQL server
 * (see harness.ts), with the exact SQL that runs on Supabase.
 *
 *   npm run test:db
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { startDatabase, type Harness } from './harness';

let db: Harness;
let c: pg.Client;
let teacherA: string;
let teacherB: string;
let eventDate: string;

/** Slot start on the event day, Asia/Jakarta time, e.g. at('09:10') */
const at = (hhmm: string) => `${eventDate}T${hhmm}:00+07:00`;

/** Call book_slot as the public (anon) role, the way the browser does. */
async function book(client: pg.Client, teacherId: string, slot: string, phone: string, child = 'Aisyah Putri') {
  await client.query('set role anon');
  try {
    const r = await client.query('select public.book_slot($1, $2, $3, $4, $5, $6, $7) as res', [
      teacherId, slot, 'Ibu Rina', child, '8B', phone, 'en',
    ]);
    return r.rows[0].res as { id: string; code: string };
  } finally {
    await client.query('reset role');
  }
}

/** The error code a call failed with (e.g. "SLOT_TAKEN"), or "OK". */
const outcome = (p: Promise<unknown>) => p.then(() => 'OK', (e: Error) => e.message);

beforeAll(async () => {
  db = await startDatabase();
  c = await db.connect();
  const t = await c.query(`select id from public.teachers where available order by sort_order limit 2`);
  [teacherA, teacherB] = t.rows.map((r) => r.id);
  eventDate = (await c.query(`select to_char(event_date, 'YYYY-MM-DD') d from public.settings`)).rows[0].d;
}, 120_000);

afterAll(async () => {
  await c?.end();
  await db?.stop();
});

beforeEach(async () => {
  await c.query('delete from private.bookings');
  await c.query(`update public.settings set booking_open = true, event_date = (now() at time zone 'Asia/Jakarta')::date + 30`);
  eventDate = (await c.query(`select to_char(event_date, 'YYYY-MM-DD') d from public.settings`)).rows[0].d;
});

describe('double booking is impossible', () => {
  it('two parents booking the same teacher + slot at the same moment: exactly one succeeds', async () => {
    const p1 = await db.connect();
    const p2 = await db.connect();
    try {
      // Hold parent 1's booking inside an open transaction so parent 2's call
      // is genuinely in flight at the same time and has to wait on it.
      await p1.query('begin');
      const first = await book(p1, teacherA, at('09:10'), '081111111111', 'Child One');
      const second = outcome(book(p2, teacherA, at('09:10'), '082222222222', 'Child Two'));
      await new Promise((r) => setTimeout(r, 300));
      await p1.query('commit');

      expect(first.code).toMatch(/^[A-Z2-9]{5}$/);
      expect(await second).toBe('SLOT_TAKEN');
      const n = await c.query('select count(*)::int n from private.bookings');
      expect(n.rows[0].n).toBe(1);
    } finally {
      await p1.end();
      await p2.end();
    }
  });

  it('ten simultaneous attempts on one slot → 1 success, 9 × SLOT_TAKEN', async () => {
    const clients = await Promise.all(Array.from({ length: 10 }, () => db.connect()));
    try {
      const results = await Promise.all(
        clients.map((cl, i) => outcome(book(cl, teacherA, at('10:00'), `08133300000${i}`, `Child ${i}`))),
      );
      expect(results.filter((r) => r === 'OK')).toHaveLength(1);
      expect(results.filter((r) => r === 'SLOT_TAKEN')).toHaveLength(9);
    } finally {
      await Promise.all(clients.map((cl) => cl.end()));
    }
  });

  it('a cancelled slot can be booked again', async () => {
    const b = await book(c, teacherA, at('09:00'), '081234567890');
    await c.query('select public.parent_cancel_booking($1, $2, $3)', [b.id, '+62 812-3456-7890', 'aisyah']);
    await expect(outcome(book(c, teacherA, at('09:00'), '089999999999', 'Other'))).resolves.toBe('OK');
  });
});

describe('parent rules', () => {
  it('one parent cannot book two teachers at the same time', async () => {
    await book(c, teacherA, at('09:20'), '081234567890');
    // Same phone, written differently, different teacher, same time.
    expect(await outcome(book(c, teacherB, at('09:20'), '+62 812 3456 7890'))).toBe('PARENT_BUSY');
    // A different time is fine.
    expect(await outcome(book(c, teacherB, at('09:30'), '0812-3456-7890'))).toBe('OK');
  });

  it('one slot per teacher per child', async () => {
    await book(c, teacherA, at('08:30'), '081234567890', 'Aisyah Putri');
    expect(await outcome(book(c, teacherA, at('08:40'), '081234567890', '  aisyah   PUTRI '))).toBe('ALREADY_BOOKED_TEACHER');
    // A sibling may see the same teacher.
    expect(await outcome(book(c, teacherA, at('08:50'), '081234567890', 'Bima'))).toBe('OK');
  });

  it('rejects closed booking, invalid slots and bad phone numbers with friendly codes', async () => {
    expect(await outcome(book(c, teacherA, at('09:05'), '081234567890'))).toBe('INVALID_SLOT');
    expect(await outcome(book(c, teacherA, at('12:30'), '081234567890'))).toBe('INVALID_SLOT');
    expect(await outcome(book(c, teacherA, at('12:20'), '12'))).toBe('INVALID_PHONE');
    await c.query('update public.settings set booking_open = false');
    expect(await outcome(book(c, teacherA, at('12:20'), '081234567890'))).toBe('BOOKING_CLOSED');
  });

  it('hidden (unavailable) teachers cannot be booked', async () => {
    const t = await c.query(`select id from public.teachers where not available limit 1`);
    expect(await outcome(book(c, t.rows[0].id, at('09:00'), '081234567890'))).toBe('TEACHER_UNAVAILABLE');
  });

  it('"My schedule" lookup needs the matching phone AND child name', async () => {
    await book(c, teacherA, at('09:00'), '081234567890', 'Aisyah Putri');
    const ok = await c.query('select public.parent_bookings($1, $2) r', ['081234567890', 'Aisyah']);
    expect(ok.rows[0].r).toHaveLength(1);
    const wrong = await c.query('select public.parent_bookings($1, $2) r', ['081234567890', 'Budi']);
    expect(wrong.rows[0].r).toHaveLength(0);
  });
});

describe('privacy (Row Level Security)', () => {
  it('the public role cannot read bookings, PINs or sessions', async () => {
    await book(c, teacherA, at('09:00'), '081234567890');
    await c.query('set role anon');
    try {
      for (const table of ['private.bookings', 'private.teacher_pins', 'private.sessions', 'private.secrets']) {
        expect(await outcome(c.query(`select * from ${table}`))).toMatch(/permission denied/);
      }
      expect(await outcome(c.query(`insert into public.slot_status values ('${teacherA}', now(), 'taken', null)`))).toMatch(
        /permission denied/,
      );
      expect(await outcome(c.query(`select public.set_admin_password('hacked-password')`))).toMatch(/permission denied/);
    } finally {
      await c.query('reset role');
    }
  });

  it('"busy slots" lookup by phone returns times only — no names', async () => {
    await book(c, teacherA, at('09:00'), '081234567890', 'Aisyah Putri');
    await c.query('set role anon');
    try {
      const r = (await c.query('select public.parent_busy_slots($1, $2) r', ['081234567890', 'Someone Else'])).rows[0].r;
      expect(r).toHaveLength(1);
      expect(Object.keys(r[0]).sort()).toEqual(['sameChild', 'slotStart', 'teacherId']);
      expect(r[0].sameChild).toBe(false);
      expect(JSON.stringify(r)).not.toMatch(/aisyah|rina/i);
    } finally {
      await c.query('reset role');
    }
  });

  it('the public slot table shows only taken/done and a class + initial, never names or phones', async () => {
    await book(c, teacherA, at('09:00'), '081234567890', 'Aisyah Putri');
    await c.query('set role anon');
    try {
      const r = await c.query('select * from public.slot_status');
      expect(r.rows).toHaveLength(1);
      expect(Object.keys(r.rows[0]).sort()).toEqual(['public_label', 'slot_start', 'status', 'teacher_id']);
      expect(r.rows[0].status).toBe('taken');
      expect(r.rows[0].public_label).toBe('8B – A.');
    } finally {
      await c.query('reset role');
    }
  });
});

describe('teacher and admin sessions', () => {
  it('teacher PIN login, schedule and Done marking', async () => {
    await c.query(`select public.set_admin_password('correct horse')`);
    const admin = (await c.query(`select public.admin_login('correct horse') r`)).rows[0].r;
    expect(admin.token).toBeTruthy();
    await c.query('select public.admin_set_pin($1, $2, $3)', [admin.token, teacherA, '4321']);

    const bad = (await c.query('select public.teacher_login($1, $2) r', [teacherA, '0000'])).rows[0].r;
    expect(bad.error).toBe('BAD_PIN');
    const t = (await c.query('select public.teacher_login($1, $2) r', [teacherA, '4321'])).rows[0].r;
    expect(t.token).toBeTruthy();

    const b = await book(c, teacherA, at('09:00'), '081234567890');
    const sched = (await c.query('select public.teacher_schedule($1) r', [t.token])).rows[0].r;
    expect(sched[0].parentName).toBe('Ibu Rina');
    await c.query('select public.teacher_set_status($1, $2, $3)', [t.token, b.id, 'done']);
    const s = await c.query('select status from public.slot_status');
    expect(s.rows[0].status).toBe('done');
  });

  it('wrong admin password and expired tokens are refused', async () => {
    await c.query(`select public.set_admin_password('correct horse')`);
    const r = (await c.query(`select public.admin_login('nope') r`)).rows[0].r;
    expect(r.error).toBe('BAD_PASSWORD');
    expect(await outcome(c.query(`select public.admin_bookings('not-a-token')`))).toBe('SESSION_EXPIRED');
  });

  it('changing the event date moves bookings with it; impossible time changes are refused', async () => {
    await c.query(`select public.set_admin_password('correct horse')`);
    const { token } = (await c.query(`select public.admin_login('correct horse') r`)).rows[0].r;
    await book(c, teacherA, at('12:20'), '081234567890');
    const newDate = (await c.query(`select to_char(event_date + 7, 'YYYY-MM-DD') d from public.settings`)).rows[0].d;
    await c.query(`select public.admin_save_settings($1, $2, '08:30', '12:30', 10, true)`, [token, newDate]);
    const moved = await c.query(`select to_char(slot_start at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI') s from public.slot_status`);
    expect(moved.rows[0].s).toBe(`${newDate} 12:20`);
    // Ending at 12.00 would orphan the 12.20 booking → refused, nothing changes.
    expect(await outcome(c.query(`select public.admin_save_settings($1, $2, '08:30', '12:00', 10, true)`, [token, newDate]))).toBe(
      'SCHEDULE_CONFLICT',
    );
    const s = await c.query(`select day_end::text from public.settings`);
    expect(s.rows[0].day_end).toBe('12:30:00');
  });
});
