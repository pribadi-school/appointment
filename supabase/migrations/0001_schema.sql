-- =============================================================================
-- Parent–Teacher Consultation booking — database schema
-- SMP–SMA Pribadi Depok
--
-- How to apply: paste this whole file into the Supabase SQL editor and run it,
-- or run `npm run db:setup` (see README). It is safe to run more than once.
--
-- Security model in one paragraph:
--   * Everything that contains a parent's name or phone number lives in the
--     `private` schema. Supabase never exposes that schema to the browser.
--   * The browser can only READ three public tables: settings, teachers and
--     slot_status. slot_status says "this slot is taken / done" and nothing
--     else (plus a class + first initial such as "8B – A." for the venue board).
--   * Every change (booking, cancelling, admin edits) goes through a Postgres
--     function below. Those functions check the input and the teacher or admin
--     session, and then write to the private tables.
--   * Double booking is impossible because of the UNIQUE constraint
--     bookings_teacher_slot_key on (teacher_id, slot_start). If two parents tap
--     the same slot at the same instant, Postgres lets exactly one insert win.
--
-- All times are stored as timestamptz and interpreted in Asia/Jakarta (WIB).
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;

-- -----------------------------------------------------------------------------
-- Public tables (readable by anyone with the link)
-- -----------------------------------------------------------------------------

-- Event settings: exactly one row (id = 1). Edited from the admin page.
create table if not exists public.settings (
  id            int primary key default 1 check (id = 1),
  event_date    date    not null default date '2026-12-19',
  day_start     time    not null default time '08:30',
  day_end       time    not null default time '12:30',
  slot_minutes  int     not null default 10 check (slot_minutes between 5 and 60),
  booking_open  boolean not null default true,
  updated_at    timestamptz not null default now(),
  check (day_start < day_end)
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.teachers (
  id              uuid primary key default gen_random_uuid(),
  name            text    not null check (length(btrim(name)) between 2 and 120),
  subject         text,                          -- null = no subject
  grades          int[]   not null default '{}', -- empty = shown for every grade
  role            text,                          -- free text, e.g. "8B Homeroom Teacher"
  homeroom_class  text check (homeroom_class ~ '^(7|8|9|10|11|12)[A-Z]$'),
  is_leadership   boolean not null default false,-- "Counselors & Leadership" group
  room            text,
  available       boolean not null default true, -- false = hidden from parents
  sort_order      int     not null default 0,
  created_at      timestamptz not null default now()
);

-- What the public is allowed to know about a slot. Maintained automatically by
-- a trigger on private.bookings. A missing row means "Available".
create table if not exists public.slot_status (
  teacher_id    uuid not null references public.teachers(id) on delete cascade,
  slot_start    timestamptz not null,
  status        text not null check (status in ('taken', 'done')),
  public_label  text,  -- "8B – A." (class + child's first initial); null for blocked slots
  primary key (teacher_id, slot_start)
);

-- -----------------------------------------------------------------------------
-- Private tables (never readable from the browser)
-- -----------------------------------------------------------------------------

create table if not exists private.bookings (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,
  teacher_id    uuid not null references public.teachers(id) on delete cascade,
  slot_start    timestamptz not null,
  kind          text not null default 'booking' check (kind in ('booking', 'blocked')),
  status        text not null default 'booked' check (status in ('booked', 'done', 'no_show')),
  parent_name   text,
  child_name    text,
  child_class   text,
  phone         text,  -- normalised digits incl. country code, e.g. 6281234567890
  note          text,  -- reason for a blocked slot, e.g. "Break"
  lang          text not null default 'en' check (lang in ('en', 'id')),
  created_by    text not null default 'parent' check (created_by in ('parent', 'admin')),
  created_at    timestamptz not null default now(),
  -- Normalised child name used for "one slot per teacher per child".
  child_key     text generated always as (lower(regexp_replace(btrim(child_name), '\s+', ' ', 'g'))) stored,

  -- THE double-booking guard: one row per teacher per time slot.
  constraint bookings_teacher_slot_key unique (teacher_id, slot_start),
  constraint bookings_code_key unique (code),
  constraint bookings_parent_fields check (
    kind = 'blocked' or (parent_name is not null and child_name is not null and child_class is not null)
  )
);

-- A parent (identified by phone number) cannot be in two rooms at once.
create unique index if not exists bookings_parent_slot_key
  on private.bookings (phone, slot_start) where kind = 'booking';

-- One slot per teacher per child.
create unique index if not exists bookings_child_teacher_key
  on private.bookings (teacher_id, phone, child_key) where kind = 'booking';

create index if not exists bookings_phone_idx on private.bookings (phone);

-- Teachers sign in with their name plus ONE PIN shared by all teachers (stored
-- hashed in private.secrets under 'teacher_pin'). Clean up the older
-- per-teacher PIN table and the name-only login it replaced.
drop function if exists public.admin_set_pin(text, uuid, text);
drop function if exists public.admin_generate_pins(text, boolean);
drop function if exists public.admin_pin_status(text);
drop function if exists public.teacher_login(uuid);
drop table if exists private.teacher_pins;

-- Short-lived login sessions for teachers and the admin.
create table if not exists private.sessions (
  token       text primary key,
  role        text not null check (role in ('admin', 'teacher')),
  teacher_id  uuid references public.teachers(id) on delete cascade,
  expires_at  timestamptz not null
);

-- Hashed admin password (set from the ADMIN_PASSWORD environment variable by
-- `npm run db:setup`, never shipped to the browser).
create table if not exists private.secrets (
  key   text primary key,
  salt  text not null,
  hash  text not null
);

-- Failed login attempts, used to slow down password guessing.
create table if not exists private.login_failures (
  key  text not null,
  at   timestamptz not null default now()
);
create index if not exists login_failures_key_at on private.login_failures (key, at);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.settings     enable row level security;
alter table public.teachers     enable row level security;
alter table public.slot_status  enable row level security;
alter table private.bookings    enable row level security;  -- no policies = no access
alter table private.sessions    enable row level security;
alter table private.secrets     enable row level security;
alter table private.login_failures enable row level security;

drop policy if exists "Anyone can read settings" on public.settings;
create policy "Anyone can read settings" on public.settings for select to anon, authenticated using (true);
drop policy if exists "Anyone can read teachers" on public.teachers;
create policy "Anyone can read teachers" on public.teachers for select to anon, authenticated using (true);
drop policy if exists "Anyone can read slot status" on public.slot_status;
create policy "Anyone can read slot status" on public.slot_status for select to anon, authenticated using (true);

-- Belt and braces: the browser roles may only SELECT the public tables.
revoke insert, update, delete, truncate on public.settings, public.teachers, public.slot_status from anon, authenticated;
grant select on public.settings, public.teachers, public.slot_status to anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;

-- =============================================================================
-- Internal helpers (schema private; cannot be called from the browser)
-- =============================================================================

-- Turn "0812-3456-7890", "+62 812 3456 7890" or "812345..." into "62812..."
-- Numbers typed with a leading "+" keep their own country code.
create or replace function private.normalize_phone(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if btrim(coalesce(p, '')) like '+%' then
    null; -- already international
  elsif d like '0%' then
    d := '62' || substr(d, 2);
  elsif d like '8%' then
    d := '62' || d;
  end if;
  if d !~ '^[1-9][0-9]{7,14}$' then
    raise exception 'INVALID_PHONE';
  end if;
  return d;
end $$;

create or replace function private.name_key(p text) returns text
language sql immutable set search_path = '' as $$
  select lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'))
$$;

create or replace function private.random_token() returns text
language sql volatile set search_path = '' as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
$$;

create or replace function private.hash_secret(p_salt text, p_secret text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(p_salt || ':' || p_secret, 'UTF8')), 'hex')
$$;

-- Short booking code, e.g. "K7Q2M". No 0/O/1/I to avoid confusion.
create or replace function private.new_code() returns text
language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 5)
$$;

-- Is this timestamp the start of a slot on the event day?
create or replace function private.is_valid_slot(p_slot timestamptz) returns boolean
language plpgsql stable set search_path = '' as $$
declare
  s        public.settings;
  local_ts timestamp := p_slot at time zone 'Asia/Jakarta';
  t_min    int;
  d_start  int;
  d_end    int;
begin
  select * into s from public.settings where id = 1;
  if local_ts::date <> s.event_date or extract(second from local_ts) <> 0 then
    return false;
  end if;
  t_min   := extract(hour from local_ts)::int * 60 + extract(minute from local_ts)::int;
  d_start := extract(hour from s.day_start)::int * 60 + extract(minute from s.day_start)::int;
  d_end   := extract(hour from s.day_end)::int * 60 + extract(minute from s.day_end)::int;
  return t_min >= d_start
     and t_min + s.slot_minutes <= d_end
     and (t_min - d_start) % s.slot_minutes = 0;
end $$;

-- Turn a unique-constraint name into a friendly error code for the app.
create or replace function private.raise_for_constraint(p_constraint text) returns void
language plpgsql set search_path = '' as $$
begin
  if p_constraint = 'bookings_teacher_slot_key' then
    raise exception 'SLOT_TAKEN';
  elsif p_constraint = 'bookings_parent_slot_key' then
    raise exception 'PARENT_BUSY';
  elsif p_constraint = 'bookings_child_teacher_key' then
    raise exception 'ALREADY_BOOKED_TEACHER';
  end if;
  raise exception 'UNKNOWN';
end $$;

-- The one place where a parent booking is inserted. Used by book_slot (parents)
-- and admin_book (walk-ins). The UNIQUE constraints do the real work.
create or replace function private.insert_booking(
  p_teacher_id  uuid,
  p_slot_start  timestamptz,
  p_parent_name text,
  p_child_name  text,
  p_child_class text,
  p_phone       text,
  p_lang        text,
  p_created_by  text
) returns private.bookings
language plpgsql set search_path = '' as $$
declare
  v_row        private.bookings;
  v_phone      text;
  v_constraint text;
  v_tries      int := 0;
begin
  p_parent_name := btrim(coalesce(p_parent_name, ''));
  p_child_name  := regexp_replace(btrim(coalesce(p_child_name, '')), '\s+', ' ', 'g');
  p_child_class := upper(btrim(coalesce(p_child_class, '')));
  if length(p_parent_name) not between 2 and 80
     or length(p_child_name) not between 2 and 80
     or p_child_class !~ '^(7|8|9|10|11|12)[A-Z]$' then
    raise exception 'INVALID_INPUT';
  end if;

  -- Walk-ins booked by the admin may have no phone number.
  if p_created_by = 'admin' and btrim(coalesce(p_phone, '')) = '' then
    v_phone := null;
  else
    v_phone := private.normalize_phone(p_phone);
  end if;

  if not exists (select 1 from public.teachers where id = p_teacher_id and available) then
    raise exception 'TEACHER_UNAVAILABLE';
  end if;
  if not private.is_valid_slot(p_slot_start) then
    raise exception 'INVALID_SLOT';
  end if;

  loop
    begin
      insert into private.bookings
        (code, teacher_id, slot_start, kind, parent_name, child_name, child_class, phone, lang, created_by)
      values
        (private.new_code(), p_teacher_id, p_slot_start, 'booking', p_parent_name, p_child_name,
         p_child_class, v_phone, case when p_lang = 'id' then 'id' else 'en' end, p_created_by)
      returning * into v_row;
      return v_row;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      -- A booking code collision is harmless: just draw a new code.
      if v_constraint = 'bookings_code_key' and v_tries < 5 then
        v_tries := v_tries + 1;
      else
        perform private.raise_for_constraint(v_constraint);
      end if;
    end;
  end loop;
end $$;

create or replace function private.require_session(p_token text, p_role text) returns private.sessions
language plpgsql set search_path = '' as $$
declare v private.sessions;
begin
  select * into v from private.sessions
  where token = p_token and role = p_role and expires_at > now();
  if not found then
    raise exception 'SESSION_EXPIRED';
  end if;
  return v;
end $$;

-- Booking rows with teacher details, as JSON, for teacher/admin/parent screens.
create or replace function private.booking_json(b private.bookings) returns json
language sql stable set search_path = '' as $$
  select json_build_object(
    'id', b.id, 'code', b.code, 'teacherId', b.teacher_id, 'slotStart', b.slot_start,
    'kind', b.kind, 'status', b.status, 'parentName', b.parent_name, 'childName', b.child_name,
    'childClass', b.child_class, 'phone', b.phone, 'note', b.note, 'lang', b.lang,
    'createdBy', b.created_by, 'createdAt', b.created_at
  )
$$;

-- Keep public.slot_status in step with private.bookings.
create or replace function private.sync_slot_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and
     (old.teacher_id, old.slot_start) is distinct from (new.teacher_id, new.slot_start)) then
    delete from public.slot_status where teacher_id = old.teacher_id and slot_start = old.slot_start;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.slot_status (teacher_id, slot_start, status, public_label)
    values (
      new.teacher_id, new.slot_start,
      case when new.status in ('done', 'no_show') then 'done' else 'taken' end,
      case when new.kind = 'booking' then new.child_class || ' – ' || upper(left(new.child_name, 1)) || '.' end
    )
    on conflict (teacher_id, slot_start) do update
      set status = excluded.status, public_label = excluded.public_label;
  end if;
  return null;
end $$;

drop trigger if exists bookings_sync_slot_status on private.bookings;
create trigger bookings_sync_slot_status
  after insert or update or delete on private.bookings
  for each row execute function private.sync_slot_status();

-- Only the database owner (and the security-definer functions below) may use
-- the helpers.
revoke all on all functions in schema private from public;

-- =============================================================================
-- PUBLIC FUNCTIONS — parents
-- =============================================================================

-- Book a slot. Exactly one of two simultaneous calls for the same teacher and
-- time succeeds; the other gets SLOT_TAKEN.
create or replace function public.book_slot(
  p_teacher_id  uuid,
  p_slot_start  timestamptz,
  p_parent_name text,
  p_child_name  text,
  p_child_class text,
  p_phone       text,
  p_lang        text default 'en'
) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_open boolean;
  v_row  private.bookings;
begin
  select booking_open into v_open from public.settings where id = 1;
  if not v_open then
    raise exception 'BOOKING_CLOSED';
  end if;
  if p_slot_start <= now() then
    raise exception 'SLOT_PASSED';
  end if;
  v_row := private.insert_booking(p_teacher_id, p_slot_start, p_parent_name, p_child_name,
                                  p_child_class, p_phone, p_lang, 'parent');
  return json_build_object('id', v_row.id, 'code', v_row.code);
end $$;

-- Times at which this phone number already has a booking. No names are
-- returned, only whether the booking is for the given child (sameChild).
-- Used to grey out slots so a parent can't be in two rooms at once, and to
-- show "Booked · 09.10" next to teachers this child already has.
drop function if exists public.parent_busy_slots(text);
create or replace function public.parent_busy_slots(p_phone text, p_child_name text) returns json
language plpgsql security definer set search_path = '' as $$
declare v_phone text;
begin
  begin
    v_phone := private.normalize_phone(p_phone);
  exception when others then
    return '[]'::json;
  end;
  return coalesce((
    select json_agg(json_build_object(
      'slotStart', slot_start, 'teacherId', teacher_id,
      'sameChild', child_key = private.name_key(p_child_name)))
    from private.bookings where phone = v_phone and kind = 'booking'
  ), '[]'::json);
end $$;

-- "My schedule": all bookings for this phone number, as long as the given
-- child's first name matches at least one of them (siblings are included).
create or replace function public.parent_bookings(p_phone text, p_child_name text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_phone text;
  v_first text := split_part(private.name_key(p_child_name), ' ', 1);
begin
  begin
    v_phone := private.normalize_phone(p_phone);
  exception when others then
    raise exception 'INVALID_PHONE';
  end;
  if v_first = '' or not exists (
    select 1 from private.bookings
    where phone = v_phone and kind = 'booking' and split_part(child_key, ' ', 1) = v_first
  ) then
    return '[]'::json;
  end if;
  return coalesce((
    select json_agg(private.booking_json(b) order by b.slot_start)
    from private.bookings b where b.phone = v_phone and b.kind = 'booking'
  ), '[]'::json);
end $$;

-- Cancel one of your own bookings. The slot frees up instantly for others.
create or replace function public.parent_cancel_booking(p_booking_id uuid, p_phone text, p_child_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_phone text := private.normalize_phone(p_phone);
  v_first text := split_part(private.name_key(p_child_name), ' ', 1);
  v_row   private.bookings;
begin
  if not exists (
    select 1 from private.bookings
    where phone = v_phone and kind = 'booking' and split_part(child_key, ' ', 1) = v_first
  ) then
    raise exception 'NOT_FOUND';
  end if;
  select * into v_row from private.bookings where id = p_booking_id and phone = v_phone and kind = 'booking';
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_row.status <> 'booked' or v_row.slot_start <= now() then
    raise exception 'CANNOT_CANCEL';
  end if;
  delete from private.bookings where id = v_row.id;
end $$;

-- =============================================================================
-- PUBLIC FUNCTIONS — teachers (pick your name + the shared teacher PIN)
-- =============================================================================

-- Stores the shared teacher PIN (4–10 digits) as a salted hash and signs every
-- teacher out, so a changed PIN takes effect everywhere at once.
create or replace function private.store_teacher_pin(p_pin text) returns void
language plpgsql set search_path = '' as $$
declare v_salt text := private.random_token();
begin
  if coalesce(p_pin, '') !~ '^[0-9]{4,10}$' then
    raise exception 'INVALID_PIN';
  end if;
  insert into private.secrets (key, salt, hash) values ('teacher_pin', v_salt, private.hash_secret(v_salt, p_pin))
  on conflict (key) do update set salt = excluded.salt, hash = excluded.hash;
  delete from private.sessions where role = 'teacher';
  delete from private.login_failures where key like 'teacher:%';
end $$;
revoke all on function private.store_teacher_pin(text) from public, anon, authenticated;

-- Returns {token, expiresAt} or {error}.
-- Wrong-PIN lock-out is counted per teacher ('teacher:<id>'), not globally:
-- one shared counter would let anyone lock every teacher out on the day just
-- by typing wrong PINs. 10 tries per 10 minutes still makes guessing an
-- 8-digit PIN hopeless.
create or replace function public.teacher_login(p_teacher_id uuid, p_pin text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_secret private.secrets;
  v_key    text := 'teacher:' || coalesce(p_teacher_id::text, '');
  v_token  text := private.random_token();
  v_exp    timestamptz := now() + interval '18 hours';
begin
  if not exists (select 1 from public.teachers where id = p_teacher_id) then
    return json_build_object('error', 'NOT_FOUND');
  end if;
  if (select count(*) from private.login_failures where key = v_key and at > now() - interval '10 minutes') >= 10 then
    return json_build_object('error', 'LOCKED');
  end if;
  select * into v_secret from private.secrets where key = 'teacher_pin';
  if not found then
    return json_build_object('error', 'PIN_NOT_SET');
  end if;
  if private.hash_secret(v_secret.salt, coalesce(p_pin, '')) <> v_secret.hash then
    insert into private.login_failures (key) values (v_key);
    return json_build_object('error', 'BAD_PIN');
  end if;
  delete from private.login_failures where key = v_key;
  delete from private.sessions where expires_at < now();
  insert into private.sessions (token, role, teacher_id, expires_at) values (v_token, 'teacher', p_teacher_id, v_exp);
  return json_build_object('token', v_token, 'expiresAt', v_exp, 'teacherId', p_teacher_id);
end $$;

create or replace function public.teacher_schedule(p_token text) returns json
language plpgsql security definer set search_path = '' as $$
declare v_s private.sessions := private.require_session(p_token, 'teacher');
begin
  return coalesce((
    select json_agg(private.booking_json(b) order by b.slot_start)
    from private.bookings b where b.teacher_id = v_s.teacher_id
  ), '[]'::json);
end $$;

create or replace function public.teacher_set_status(p_token text, p_booking_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_s private.sessions := private.require_session(p_token, 'teacher');
begin
  if p_status not in ('booked', 'done', 'no_show') then
    raise exception 'INVALID_INPUT';
  end if;
  update private.bookings set status = p_status
  where id = p_booking_id and teacher_id = v_s.teacher_id and kind = 'booking';
  if not found then
    raise exception 'NOT_FOUND';
  end if;
end $$;

-- =============================================================================
-- PUBLIC FUNCTIONS — admin (password login)
-- =============================================================================

create or replace function public.admin_login(p_password text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_secret private.secrets;
  v_token  text := private.random_token();
  v_exp    timestamptz := now() + interval '12 hours';
begin
  if (select count(*) from private.login_failures where key = 'admin' and at > now() - interval '15 minutes') >= 30 then
    return json_build_object('error', 'LOCKED');
  end if;
  select * into v_secret from private.secrets where key = 'admin_password';
  if not found then
    return json_build_object('error', 'ADMIN_NOT_SET');
  end if;
  if private.hash_secret(v_secret.salt, coalesce(p_password, '')) <> v_secret.hash then
    insert into private.login_failures (key) values ('admin');
    return json_build_object('error', 'BAD_PASSWORD');
  end if;
  delete from private.sessions where expires_at < now();
  insert into private.sessions (token, role, expires_at) values (v_token, 'admin', v_exp);
  return json_build_object('token', v_token, 'expiresAt', v_exp);
end $$;

create or replace function public.logout(p_token text) returns void
language sql security definer set search_path = '' as $$
  delete from private.sessions where token = p_token
$$;

create or replace function public.admin_bookings(p_token text) returns json
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_session(p_token, 'admin');
  return coalesce((
    select json_agg(private.booking_json(b) order by b.slot_start, b.teacher_id) from private.bookings b
  ), '[]'::json);
end $$;

-- Book on behalf of a parent (walk-ins). Works even when public booking is
-- closed or the slot has already started. Phone number is optional.
create or replace function public.admin_book(
  p_token text, p_teacher_id uuid, p_slot_start timestamptz,
  p_parent_name text, p_child_name text, p_child_class text, p_phone text, p_lang text default 'en'
) returns json
language plpgsql security definer set search_path = '' as $$
declare v_row private.bookings;
begin
  perform private.require_session(p_token, 'admin');
  v_row := private.insert_booking(p_teacher_id, p_slot_start, p_parent_name, p_child_name,
                                  p_child_class, p_phone, p_lang, 'admin');
  return json_build_object('id', v_row.id, 'code', v_row.code);
end $$;

create or replace function public.admin_move_booking(p_token text, p_booking_id uuid, p_teacher_id uuid, p_slot_start timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare v_constraint text;
begin
  perform private.require_session(p_token, 'admin');
  if not private.is_valid_slot(p_slot_start) then
    raise exception 'INVALID_SLOT';
  end if;
  begin
    update private.bookings set teacher_id = p_teacher_id, slot_start = p_slot_start
    where id = p_booking_id;
    if not found then
      raise exception 'NOT_FOUND';
    end if;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_for_constraint(v_constraint);
  end;
end $$;

-- Cancels a booking or removes a block.
create or replace function public.admin_cancel_booking(p_token text, p_booking_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_session(p_token, 'admin');
  delete from private.bookings where id = p_booking_id;
end $$;

create or replace function public.admin_set_status(p_token text, p_booking_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_session(p_token, 'admin');
  if p_status not in ('booked', 'done', 'no_show') then
    raise exception 'INVALID_INPUT';
  end if;
  update private.bookings set status = p_status where id = p_booking_id and kind = 'booking';
end $$;

-- Block a slot, e.g. a teacher's break. Shows as "Taken" to parents.
create or replace function public.admin_block_slot(p_token text, p_teacher_id uuid, p_slot_start timestamptz, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_session(p_token, 'admin');
  if not private.is_valid_slot(p_slot_start) then
    raise exception 'INVALID_SLOT';
  end if;
  begin
    insert into private.bookings (code, teacher_id, slot_start, kind, note, created_by)
    values (private.new_code(), p_teacher_id, p_slot_start, 'blocked', nullif(btrim(coalesce(p_note, '')), ''), 'admin');
  exception when unique_violation then
    raise exception 'SLOT_TAKEN';
  end;
end $$;

-- Create (no id) or update a teacher. Returns the teacher id.
create or replace function public.admin_save_teacher(p_token text, p_teacher json) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id     uuid := nullif(p_teacher->>'id', '')::uuid;
  v_grades int[] := coalesce(array(select json_array_elements_text(coalesce(p_teacher->'grades', '[]'::json))::int), '{}');
begin
  perform private.require_session(p_token, 'admin');
  if length(btrim(coalesce(p_teacher->>'name', ''))) < 2 then
    raise exception 'INVALID_INPUT';
  end if;
  if exists (select 1 from unnest(v_grades) g where g not between 7 and 12) then
    raise exception 'INVALID_INPUT';
  end if;
  if v_id is null then
    insert into public.teachers (name, subject, grades, role, homeroom_class, is_leadership, room, available, sort_order)
    values (
      btrim(p_teacher->>'name'),
      nullif(btrim(coalesce(p_teacher->>'subject', '')), ''),
      v_grades,
      nullif(btrim(coalesce(p_teacher->>'role', '')), ''),
      nullif(upper(btrim(coalesce(p_teacher->>'homeroomClass', ''))), ''),
      coalesce((p_teacher->>'isLeadership')::boolean, false),
      nullif(btrim(coalesce(p_teacher->>'room', '')), ''),
      coalesce((p_teacher->>'available')::boolean, true),
      coalesce((p_teacher->>'sortOrder')::int, (select coalesce(max(sort_order), 0) + 1 from public.teachers))
    )
    returning id into v_id;
  else
    update public.teachers set
      name           = btrim(p_teacher->>'name'),
      subject        = nullif(btrim(coalesce(p_teacher->>'subject', '')), ''),
      grades         = v_grades,
      role           = nullif(btrim(coalesce(p_teacher->>'role', '')), ''),
      homeroom_class = nullif(upper(btrim(coalesce(p_teacher->>'homeroomClass', ''))), ''),
      is_leadership  = coalesce((p_teacher->>'isLeadership')::boolean, false),
      room           = nullif(btrim(coalesce(p_teacher->>'room', '')), ''),
      available      = coalesce((p_teacher->>'available')::boolean, true),
      sort_order     = coalesce((p_teacher->>'sortOrder')::int, sort_order)
    where id = v_id;
    if not found then
      raise exception 'NOT_FOUND';
    end if;
  end if;
  return v_id;
exception when check_violation then
  raise exception 'INVALID_INPUT';
end $$;

-- Set the room for every teacher of one subject at once.
create or replace function public.admin_set_room_for_subject(p_token text, p_subject text, p_room text) returns int
language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  perform private.require_session(p_token, 'admin');
  update public.teachers set room = nullif(btrim(coalesce(p_room, '')), '')
  where coalesce(subject, '') = coalesce(p_subject, '');
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Deletes the teacher AND their bookings.
create or replace function public.admin_delete_teacher(p_token text, p_teacher_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_session(p_token, 'admin');
  delete from public.teachers where id = p_teacher_id;
end $$;

-- Save event settings. If the date changes, existing bookings move with it.
-- Refuses (SCHEDULE_CONFLICT) if existing bookings would not fit new times.
create or replace function public.admin_save_settings(
  p_token text, p_event_date date, p_day_start time, p_day_end time, p_slot_minutes int, p_booking_open boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_old public.settings;
begin
  perform private.require_session(p_token, 'admin');
  if p_day_start >= p_day_end or p_slot_minutes not between 5 and 60 then
    raise exception 'INVALID_INPUT';
  end if;
  select * into v_old from public.settings where id = 1;
  if p_event_date <> v_old.event_date then
    update private.bookings set slot_start = slot_start + (p_event_date - v_old.event_date) * interval '1 day';
  end if;
  update public.settings set
    event_date = p_event_date, day_start = p_day_start, day_end = p_day_end,
    slot_minutes = p_slot_minutes, booking_open = p_booking_open, updated_at = now()
  where id = 1;
  if exists (select 1 from private.bookings b where not private.is_valid_slot(b.slot_start)) then
    raise exception 'SCHEDULE_CONFLICT';  -- rolls back everything above
  end if;
end $$;

-- Maintenance actions. The admin must type the password again, even while
-- signed in. Returns {count} or {error}; errors are returned (not raised) so a
-- wrong password still counts toward the admin lock-out.
--   sign_out_teachers  ends every teacher session
--   sign_out_all       ends every teacher and admin session except this one
--   clear_bookings     deletes ALL bookings and blocked slots (teachers and
--                      settings are kept)
create or replace function public.admin_maintenance(p_token text, p_password text, p_action text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_s      private.sessions := private.require_session(p_token, 'admin');
  v_secret private.secrets;
  v_count  int;
begin
  if (select count(*) from private.login_failures where key = 'admin' and at > now() - interval '15 minutes') >= 30 then
    return json_build_object('error', 'LOCKED');
  end if;
  select * into v_secret from private.secrets where key = 'admin_password';
  if not found or private.hash_secret(v_secret.salt, coalesce(p_password, '')) <> v_secret.hash then
    insert into private.login_failures (key) values ('admin');
    return json_build_object('error', 'BAD_PASSWORD');
  end if;
  if p_action = 'sign_out_teachers' then
    delete from private.sessions where role = 'teacher';
  elsif p_action = 'sign_out_all' then
    delete from private.sessions where token <> v_s.token;
  elsif p_action = 'clear_bookings' then
    delete from private.bookings;
  else
    return json_build_object('error', 'INVALID_INPUT');
  end if;
  get diagnostics v_count = row_count;
  return json_build_object('count', v_count);
end $$;

-- Change the shared teacher PIN from the Admin page. Needs the admin password
-- again (counts toward the admin lock-out, like admin_maintenance) and signs
-- every teacher out. Returns {ok} or {error}.
create or replace function public.admin_set_teacher_pin(p_token text, p_password text, p_pin text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_s      private.sessions := private.require_session(p_token, 'admin');
  v_secret private.secrets;
begin
  if (select count(*) from private.login_failures where key = 'admin' and at > now() - interval '15 minutes') >= 30 then
    return json_build_object('error', 'LOCKED');
  end if;
  select * into v_secret from private.secrets where key = 'admin_password';
  if not found or private.hash_secret(v_secret.salt, coalesce(p_password, '')) <> v_secret.hash then
    insert into private.login_failures (key) values ('admin');
    return json_build_object('error', 'BAD_PASSWORD');
  end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4,10}$' then
    return json_build_object('error', 'INVALID_PIN');
  end if;
  perform private.store_teacher_pin(p_pin);
  return json_build_object('ok', true);
end $$;

-- Only callable by the database owner (from `npm run db:setup`).
create or replace function public.set_teacher_pin(p_pin text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.store_teacher_pin(p_pin);
end $$;
revoke all on function public.set_teacher_pin(text) from public, anon, authenticated;

-- Only callable by the database owner (from `npm run db:setup`).
create or replace function public.set_admin_password(p_password text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_salt text := private.random_token();
begin
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'Admin password must be at least 8 characters';
  end if;
  insert into private.secrets (key, salt, hash) values ('admin_password', v_salt, private.hash_secret(v_salt, p_password))
  on conflict (key) do update set salt = excluded.salt, hash = excluded.hash;
  delete from private.sessions where role = 'admin';
end $$;
revoke all on function public.set_admin_password(text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Realtime: broadcast changes to the three public tables.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['slot_status', 'teachers', 'settings'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
