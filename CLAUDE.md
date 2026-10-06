# Parent–Teacher Consultation app — project notes

Booking app for SMP–SMA Pribadi Depok's report card day: parents book a
consultation slot with a teacher from their phone, no account needed.
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

## Database rules — don't weaken these

The guarantees in README "How double booking is prevented" and "Privacy and
security" are enforced by the database, not the UI:
- `bookings_teacher_slot_key` UNIQUE(teacher_id, slot_start), plus the
  one-room-at-a-time and one-slot-per-teacher-per-child rules.
- All writes go through checked Postgres functions (`book_slot`, …); parent
  names/phones live in the `private` schema; RLS is on for every table.
- Never expose the service_role key or read `private` from the browser.

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
- `SUPABASE_DB_URL` (contains the DB password) and `ADMIN_PASSWORD` — used
  only by `npm run db:setup` on the local machine. Never prefix with `VITE_`
  (that would ship them to every visitor), never commit, never paste in chat.

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
- Event date (default 19 Dec 2026) and room names are placeholders, changed
  from the Admin page, not in code.
