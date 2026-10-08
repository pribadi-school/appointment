# Parent–Teacher Consultation app — project notes

Booking app for SD–SMP–SMA Pribadi Depok's report card day: parents book a
consultation slot with a teacher from their phone, no account needed.
`/` greets them and asks the level: `/sd` (class → time) or `/smp-sma`
(teacher → time).
README.md is the user-facing guide (setup, deploy, how booking works) — read
it first; this file is what's easy to get wrong while changing the code.

Stack: React 19 + Vite + TypeScript, Tailwind v4, Supabase (Postgres +
Realtime), hosted on Vercel. GitHub: `pribadi-school/appointment`, branch `main`.

Sister project: the school website lives in `../app/public` (WordPress), its
own repo `pribadi-school/pribadi-school`. The two share a design system but
nothing else — don't mix their changes in one commit.

## Design system

`design-system/sekolah-pribadi-depok/MASTER.md` is the school's design system,
shared with the website (`../app/public/design-system/...`). It is a **copy**:
if the brand changes, update both. `pages/appointment-app.md` holds this app's
own additions and overrides (the AA-safe action blue, slot status colours,
live indicator) and wins over MASTER.md where they differ.

Hard rules:
- Every colour comes from a token in `src/index.css` `@theme`, which mirrors
  MASTER.md. Tailwind's default palette is deliberately removed
  (`--color-*: initial`), so `bg-blue-500` etc. won't exist — use the brand
  tokens, add new ones to `@theme` (derived from the palette) if needed.
- Interactive fills and blue text use `action` (#0172bb), never `primary`
  (#18a8fa): white on #18a8fa fails contrast. See appointment-app.md §1.
- Status must never be shown by colour alone (colour + icon + label).
- Respect `prefers-reduced-motion` (motion is disabled, not shortened).

## Two modes

`src/lib/api/index.ts` picks the backend (`api.ts` is the shared interface):
- **supabase** when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
  (in `.env` locally, in Vercel env vars in production).
- **demo** when they're empty: everything in this browser's storage, admin
  password `demo`. Use it to preview UI changes without touching real data.

Any feature added to `supabaseApi.ts` must also exist in `demoApi.ts`, or demo
mode (and the e2e tests, which run in demo mode) break.

## Two levels (SD and SMP–SMA)

Every teacher row has `level` ('sd' | 'smp_sma'). An SD row is a *class*
(homeroom_class '1'…'6'), named after its two homeroom teachers. Each level has
its own day and slot length (`settings.day_*`/`slot_minutes` vs `sd_*`), so:
- A teacher/SD class can override its level's day: `day_start`,
  `slot_minutes`, `slot_count` (set per grade in Event settings, per teacher in
  Teachers). Never use `settings.slotMinutes` / `slotStarts(settings)` /
  `scheduleFor` for a specific teacher — use `teacherSchedule(settings,
  teacher)` / `teacherMinutes` from `src/lib/time.ts`. Grids (board,
  dashboard) are one per level, columns = `levelGrid()` (every start any
  teacher has).
- SQL: `teacher_slot_ok(teacher, slot)` / `teacher_minutes(teacher)`; class must fit the level
  (`class_fits_level`); "one room at a time" is an *overlap* check
  (`parent_overlaps`) under a per-phone advisory lock, not equal start times.
- Show SD classes with `classLabel()` ("Grade 3" / "Kelas 3"), never the raw "3".

## Database rules — don't weaken these

The guarantees in README "How double booking is prevented" and "Privacy and
security" are enforced by the database, not the UI:
- `bookings_teacher_slot_key` UNIQUE(teacher_id, slot_start), plus the
  one-room-at-a-time and one-slot-per-teacher-per-child rules.
- All writes go through checked Postgres functions (`book_slot`, …); parent
  names/phones live in the `private` schema; RLS is on for every table.
- Never expose the service_role key or read `private` from the browser.
- Teacher sign-in = name + ONE shared PIN (`teacher_login(id, pin)`), stored
  hashed in `private.secrets` ('teacher_pin'). Never check the PIN in the
  browser or put it in code/git. Wrong-PIN lock-out is keyed per teacher
  (`teacher:<id>`) on purpose — a global counter lets anyone lock all
  teachers out. `db:setup` only sets the PIN if none exists; changing it
  (Admin page / `db:teacher-pin`) signs every teacher out.

Schema changes go in `supabase/migrations/` (currently one file,
`0001_schema.sql`, re-runnable). `npm run db:setup` applies it and never
deletes bookings or teachers. Run `npm run test:db` after any SQL change —
it proves the concurrency guarantees against a real (embedded) Postgres.

Teacher list: edit `src/data/seedTeachers.ts`, then `npm run seed:generate`
to rebuild `supabase/seed.sql`. Never hand-edit seed.sql.

## Secrets

`.env` is git-ignored and must stay that way. It holds:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — public by design (they ship
  to the browser); RLS is what protects data.
- `SUPABASE_DB_URL` (contains the DB password), `ADMIN_PASSWORD` and
  `TEACHER_PIN` — used only by `npm run db:setup` on the local machine. Never prefix with `VITE_`
  (that would ship them to every visitor), never commit, never paste in chat.

## Hosting

Hosted on the school's cPanel (Niagahoster, user `pribadisch`) as
**report.pribadidepok.sch.id** (subdomain folder `public_html/report`), not on
Vercel. The database stays on Supabase.

cPanel can't build, so built files go on a separate branch, `deploy`
(generated — never edit it by hand). On the server, `~/repositories/appointment`
is a clone of `deploy` (outside `public_html`, so `.git` is never served); the
branch's `deploy.sh` copies the files into `public_html/report`.

To release a change:
1. Commit and push to `main`.
2. `.github/workflows/deploy.yml` then runs `npm run deploy` on GitHub by
   itself (the public Supabase URL/anon key are in that file; never add the
   DB URL, admin password or teacher PIN there). By hand, `npm run deploy`
   (`scripts/publish-deploy.ts`) refuses a dirty tree and checks `.env` has the real
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — Vite bakes them into the
   files, and built with them empty the live site silently runs in demo mode —
   then builds and pushes `dist/` + `.cpanel.yml` to `deploy`.
3. cPanel → Terminal:
   `cd ~/repositories/appointment && git pull && bash deploy.sh`

The `deploy` branch keeps linear history on purpose: the server does a plain
`git pull`, which fails on a force-pushed branch.

Supabase free projects pause after 7 days without activity: open the
Supabase dashboard a few days before the event and resume it if paused.

## Everyday commands

| Command | Use |
|---|---|
| `npm run dev` | local dev server, http://localhost:5173 |
| `npm run build` | type-check + production build — run before pushing |
| `npm run test:db` | database/concurrency tests |
| `npm run test:e2e` | browser tests (demo mode, 360px + 768px, EN + ID) |

## Other conventions

- All UI text lives in `src/lib/i18n.tsx`, in **both** English and Bahasa
  Indonesia. A string added in one language must be added in the other.
- Times are always Asia/Jakarta (WIB), shown as `09.10`, whatever the
  visitor's phone timezone. Use the helpers in `src/lib/time.ts`.
- Parents are on phones: check every change at 360px wide.
- Event date (default 17 Oct 2026) and room names are placeholders, changed
  from the Admin page, not in code.
