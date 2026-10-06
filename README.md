# Parent–Teacher Consultation booking

**SMP–SMA Pribadi Depok · report card day (grades 7–12)**

Parents book a short consultation slot with a teacher from their phone. They
don't need to install an app or create an account: they open a link or scan a
QR code. Each teacher has only **one parent per time slot**, and the database
enforces that. Parents, teachers, the venue TV and the admin all see slots
update live.

| Page | Who | Link |
|---|---|---|
| Book a consultation | Parents (share this link / QR) | `/` |
| My schedule | Parents | `/my` |
| Live board | Venue TV, anyone | `/board` |
| Teacher schedule | Teachers (name + teacher PIN) | `/teacher` |
| Admin | School staff (password) | `/admin` |

The app is in English by default, with an **EN | ID** switch in the header.
The choice is remembered on each device.

---

## Try it in 1 minute (demo mode, no setup)

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. Without Supabase settings the app runs in **demo
mode**: data is stored only in that browser, and tabs update each other live.

- Admin password: `demo`
- Teachers: pick your name on `/teacher`, PIN `1234`
- Rehearse the day: add `?now=09:12` to `/board` or `/teacher` to see the
  board as it would look at 09.12 on the event day.

> Demo mode is for previewing only. It is not secure and not shared between
> devices. The real event needs Supabase (below).

---

## Set up for the real event

### 1. Create a Supabase project (free tier is enough)

1. Go to https://supabase.com, create a project, and pick the **Southeast Asia
   (Singapore)** region.
2. Note the **database password** you choose.

### 2. Fill in `.env`

Copy `.env.example` to `.env` and fill in:

| Setting | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | same page → `anon` / publishable key (**not** service_role) |
| `SUPABASE_DB_URL` | Supabase → **Connect** → Session pooler → URI (put your DB password in it) |
| `ADMIN_PASSWORD` | choose a long password for the admin page (8+ characters) |
| `TEACHER_PIN` | the PIN all teachers share to sign in (4–10 digits) |

`ADMIN_PASSWORD` and `SUPABASE_DB_URL` are used **only** by the setup command
on your computer. They are never sent to the browser. Don't add `VITE_` to
them.

### 3. Create the database

```bash
npm run db:setup
```

This creates the tables, security rules and booking functions, adds the
teacher list, and sets the admin password. It is safe to run again: it never
deletes bookings or teachers.

*No terminal access?* Paste `supabase/migrations/0001_schema.sql` and then
`supabase/seed.sql` into Supabase → **SQL Editor** → Run. Then set the admin
password by running this once in the SQL editor:
`select public.set_admin_password('your-long-password');`

To change the admin password later, update `ADMIN_PASSWORD` in `.env` and run
`npm run db:admin-password`.

**Teacher PIN.** Every teacher signs in with their name plus one shared PIN.
`npm run db:setup` sets it from `TEACHER_PIN` only if no PIN exists yet, so
re-running setup never resets it. Change it any time from **Admin → Event
settings → Teacher PIN** (or update `.env` and run `npm run db:teacher-pin`).
Changing it signs every teacher out. Without a terminal, run
`select public.set_teacher_pin('12345678');` in the SQL editor.

### 4. Check Realtime is on

The setup adds the `slot_status`, `teachers` and `settings` tables to Supabase
Realtime. To check, go to Supabase → Database → Publications →
`supabase_realtime`; all three should be listed.

### 5. Deploy to Vercel

1. Push this folder to a GitHub repository.
2. On https://vercel.com, click **Add New → Project** and import the repository.
   The framework is detected as **Vite**.
3. Under **Environment Variables**, add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`. These are the only two Vercel needs.
4. Click Deploy. `vercel.json` already makes links like `/board` work on refresh.

Netlify, Cloudflare Pages and others work too: build command `npm run build`,
output folder `dist`, and add an SPA fallback to `index.html`.

### 6. Before the day (from the Admin page, no code)

1. **Event settings**: set the event date, the first/last slot times and the
   slot length. Booking can be opened and closed here or on the dashboard.
2. **Teachers → Rooms by subject**: replace the placeholder room names with
   the real ones. You can also edit any single teacher's room.
3. **QR code**: print the poster and share the link in parent WhatsApp groups.

---

## How double booking is prevented

- The database has a **UNIQUE constraint on (teacher_id, slot_start)**
  (`bookings_teacher_slot_key`). Postgres itself refuses a second booking for
  the same teacher and time, however the request arrives.
- Parents book through one Postgres function, `book_slot`. It validates the
  input and inserts in one step. If two parents tap the same slot at the same
  moment, exactly one insert wins and the other gets `SLOT_TAKEN`. That parent
  sees *"Sorry, this time was just booked by another parent. Please choose
  another time."* and returns to the time picker with fresh slots.
- Two more unique rules: a phone number can't be in **two rooms at the same
  time**, and a child can have only **one slot per teacher**.
- These are proven by `tests/db/booking.test.ts` against a real PostgreSQL:
  two simultaneous bookings, and ten simultaneous bookings, each give exactly
  one success.

## Privacy and security

- Parent names and phone numbers are stored in the `private` schema, which
  Supabase never exposes to browsers. Row Level Security is on for every table.
- The public can read only `settings`, `teachers`, and `slot_status`.
  `slot_status` shows *taken/done* plus a class and initial such as
  "8B – A." for the venue board, and nothing else.
- Every change goes through a checked Postgres function. The admin password
  and the teacher PIN are stored only as salted hashes, never in the app's code. Logins create sessions that expire
  (teachers after 18h, admin after 12h).
- **Teachers sign in with their name and the shared teacher PIN.** A teacher
  sees only their own schedule (parent names and WhatsApp numbers). After 10
  wrong PINs, that teacher's sign-in pauses for 10 minutes; the limit is per
  teacher, so nobody can lock every teacher out at once. Because the PIN is
  shared, anyone who knows it could open any teacher's schedule: give it only
  to teachers, and change it if it leaks.
- "My schedule" requires **both** the WhatsApp number **and** the child's name.

## Timezone

Everything runs on **Asia/Jakarta (WIB)**, whatever timezone a visitor's phone
uses. Times show as 09.10.

---

## For developers

```
src/
  pages/            BookPage (+ book/ steps), MySchedulePage, BoardPage, TeacherPage, admin/
  components/       UI building blocks (Button, BottomSheet, Header, Toast …)
  lib/api/          supabaseApi.ts (real), demoApi.ts (offline demo), api.ts (interface)
  lib/i18n.tsx      all text in English + Bahasa Indonesia
  lib/live.tsx      Realtime subscription, change animation, safety polling
  data/seedTeachers.ts   initial teacher list (→ supabase/seed.sql)
supabase/
  migrations/0001_schema.sql   tables, RLS, functions, Realtime
  seed.sql                     generated: npm run seed:generate
design-system/sekolah-pribadi-depok/
  MASTER.md                    the school design system (source of truth)
  pages/appointment-app.md     what this app adds (status colours, live dot …)
tests/
  db/    real-Postgres tests (concurrency, RLS, rules)
  e2e/   Playwright: full parent flow at 360px in EN + ID, 768px, staff pages
```

| Command | What it does |
|---|---|
| `npm run dev` | local dev server |
| `npm run build` | type-check + production build into `dist/` |
| `npm run test:db` | database tests (downloads nothing; uses embedded PostgreSQL) |
| `npm run test:e2e` | browser tests in demo mode (uses installed Edge; set `PW_CHANNEL=chrome` for Chrome) |
| `npm run seed:generate` | rebuild `supabase/seed.sql` from `src/data/seedTeachers.ts` |

Placeholders to confirm: the **event date** (default 19 December 2026) and the
**room names** are placeholders. Change both from the Admin page.
