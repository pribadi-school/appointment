/**
 * "Now" screen for the venue TV (admin only): one card per consultation
 * happening right now, with teacher, room and booking code, so parents can
 * find where to go. Cards are grouped by room; when they don't all fit, the
 * screen pages through them every 10 seconds. Updates live and moves on by
 * itself when slots change (each teacher on their own times).
 */
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Backpack, CalendarDays, ChevronRight, Clock, MapPin, School } from 'lucide-react';
import { Header, SchoolLogo } from '../components/Header';
import { Button, Card, Field, Notice, Skeleton, StatusPill, cx } from '../components/ui';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useLive, useNow } from '../lib/live';
import { KEYS, load, save } from '../lib/storage';
import { classLabel } from '../lib/teachers';
import { fmtDate, fmtRange, fmtTime, jakartaDate, jakartaTime, slotStarts, teacherSchedule } from '../lib/time';
import { errorCode, type Booking, type ErrorCode, type Level, type Session, type Settings, type Teacher } from '../lib/types';

const PAGE_MS = 15_000;
// TV layout per level, sized from the real bookings: SMP–SMA peaks at ~20
// sessions at once (2 pages of 5 × 2), SD at 6 (one page of 3 × 2).
const TV_GRID: Record<Level, { cols: number; rows: number }> = { smp_sma: { cols: 5, rows: 2 }, sd: { cols: 3, rows: 2 } };

/** /now = choose the level; /now/sd and /now/smp-sma = that level's screen. */
export default function NowPage({ level }: { level?: Level }) {
  const [session, setSession] = useState<Session | null>(() => {
    const s = load<Session | null>(KEYS.adminSession, null);
    return s && s.expiresAt > Date.now() ? s : null;
  });
  const signIn = (s: Session) => {
    save(KEYS.adminSession, s);
    setSession(s);
  };
  const signOut = useCallback(() => {
    save(KEYS.adminSession, null);
    setSession(null);
  }, []);
  if (!session) return <NowLogin onSignIn={signIn} />;
  return level ? <NowScreen key={level} level={level} token={session.token} onExpired={signOut} /> : <NowChoose />;
}

/** Same admin password as /admin; the session is shared with the Admin page. */
function NowLogin({ onSignIn }: { onSignIn: (s: Session) => void }) {
  const { t, errorText } = useI18n();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSignIn(await api.adminLogin(password));
    } catch (err) {
      setError(errorCode(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="min-h-dvh">
      <Header title={t('now_title')} />
      <main className="mx-auto max-w-md px-4 pt-8">
        <h1 className="text-2xl font-bold">{t('now_title')}</h1>
        <p className="mt-1 mb-6 text-base text-muted-foreground">{t('now_signIn')}</p>
        <form onSubmit={submit} className="space-y-5">
          <Field label={t('a_password')} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <Notice tone="error">{errorText(error)}</Notice>}
          <Button type="submit" block loading={busy} disabled={!password}>
            {t('a_signIn')}
          </Button>
        </form>
      </main>
    </div>
  );
}

type Now = { teacher: Teacher; booking: Booking; minutes: number; next: Booking | undefined };

/** Pick which level's screen this TV shows. */
function NowChoose() {
  const { t } = useI18n();
  const options: { to: string; title: string; icon: typeof School }[] = [
    { to: '/now/sd', title: t('lvl_sd'), icon: Backpack },
    { to: '/now/smp-sma', title: t('lvl_smp'), icon: School },
  ];
  return (
    <div className="min-h-dvh">
      <Header title={t('now_title')} />
      <main className="mx-auto max-w-3xl px-4 pt-6 pb-16">
        <h1 className="text-[28px] leading-tight font-bold">{t('now_title')}</h1>
        <p className="mt-2 mb-6 text-base text-muted-foreground">{t('now_choose')}</p>
        <ul className="divide-y divide-border-strong overflow-hidden rounded-lg border border-border-strong bg-surface sm:grid sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          {options.map(({ to, title, icon: Icon }) => (
            <li key={to}>
              <Link to={to} className="flex h-full items-center gap-4 px-4 py-4 transition-colors duration-150 hover:bg-surface-page active:bg-surface-muted">
                <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-md bg-surface-muted text-muted-foreground" aria-hidden>
                  <Icon className="size-6" />
                </span>
                <span className="min-w-0 flex-1 text-lg leading-snug font-semibold text-foreground">{title}</span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

/**
 * Public preview with sample data (/livedummy, /livedummy/sd): real teacher
 * names and rooms, made-up booking codes, generated in the browser. Nothing is
 * read from or written to the bookings. Its clock starts at 09.05 today when
 * the page opens and then runs in real time, so there are always sessions.
 */
export function NowDummyPage({ level }: { level: Level }) {
  return <NowScreen level={level} dummy />;
}

const DUMMY_START = '09:05';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DUMMY_CLASSES = ['7A', '7B', '7C', '8A', '8B', '9A', '9B', '10A', '10B', '11A', '11B', '12A', '12B'];

/** Same input, same code: stable across re-renders. */
function sampleCode(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let out = '';
  for (let i = 0; i < 5; i++) {
    out += CODE_CHARS[(h >>> 0) % 32];
    h = Math.imul(h ^ (h >>> 13), 2246822507);
  }
  return out;
}

function sampleBookings(settings: Settings, teachers: Teacher[], level: Level): Booking[] {
  const out: Booking[] = [];
  for (const teacher of teachers.filter((x) => x.available && x.level === level)) {
    slotStarts(teacherSchedule(settings, teacher)).forEach((s, i) => {
      const code = sampleCode(`${teacher.id}|${s}`);
      out.push({
        id: `${teacher.id}|${s}`, code, teacherId: teacher.id, slotStart: s, kind: 'booking', status: 'booked',
        parentName: null, childName: null, childClass: level === 'sd' ? teacher.homeroomClass : DUMMY_CLASSES[(code.charCodeAt(0) + i) % DUMMY_CLASSES.length],
        phone: null, note: null, lang: 'en', createdBy: 'parent', createdAt: 0,
      });
    });
  }
  return out;
}

function NowScreen({ level, token, onExpired, dummy }: { level: Level; token?: string; onExpired?: () => void; dummy?: boolean }) {
  const { t, lang } = useI18n();
  const { settings: liveSettings, teachers, version } = useLive();
  const clock = useNow(5_000);
  // Sample mode: the event is "today" and the clock starts at 09.05.
  const [openedAt] = useState(() => Date.now());
  const today = jakartaDate(clock.now);
  const settings = useMemo(() => (dummy && liveSettings ? { ...liveSettings, eventDate: today } : liveSettings), [dummy, liveSettings, today]);
  const now = dummy && settings ? jakartaTime(settings.eventDate, DUMMY_START) + (clock.now - openedAt) : clock.now;
  const simulated = dummy || clock.simulated;
  const [fetched, setFetched] = useState<Booking[] | null>(null);
  const sample = useMemo(() => (dummy && settings ? sampleBookings(settings, teachers, level) : null), [dummy, settings, teachers, level]);
  const bookings = dummy ? sample : fetched;
  const [page, setPage] = useState(0);

  const fetchBookings = useCallback(async () => {
    if (dummy || !token) return;
    try {
      setFetched(await api.adminBookings(token));
    } catch (e) {
      if (errorCode(e) === 'SESSION_EXPIRED') onExpired?.();
    }
  }, [dummy, token, onExpired]);

  // Live: on every slot change, plus a 15-second safety poll.
  useEffect(() => {
    fetchBookings();
  }, [fetchBookings, version]);
  useEffect(() => {
    const id = setInterval(fetchBookings, 15_000);
    return () => clearInterval(id);
  }, [fetchBookings]);

  // TV (wide screens): a fixed grid per level, paged. Smaller screens: all cards, scrolling.
  const [tv, setTv] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    const fit = () => setTv(window.innerWidth >= 1024);
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  const grid = TV_GRID[level];
  const perPage = tv ? grid.cols * grid.rows : 999;

  // Consultations in progress right now, each teacher on their own schedule.
  const { current, nextStart } = useMemo(() => {
    const out: Now[] = [];
    let nextStart = Infinity;
    if (!settings || !bookings) return { current: out, nextStart };
    const byKey = new Map(bookings.filter((b) => b.kind === 'booking').map((b) => [`${b.teacherId}|${b.slotStart}`, b]));
    for (const teacher of teachers.filter((x) => x.available && x.level === level)) {
      const sch = teacherSchedule(settings, teacher);
      const starts = slotStarts(sch);
      const ms = sch.slotMinutes * 60_000;
      for (const s of starts) if (s > now && byKey.has(`${teacher.id}|${s}`)) nextStart = Math.min(nextStart, s);
      const start = starts.find((s) => now >= s && now < s + ms);
      const booking = start !== undefined ? byKey.get(`${teacher.id}|${start}`) : undefined;
      if (!booking) continue;
      const next = starts.filter((s) => s > booking.slotStart).map((s) => byKey.get(`${teacher.id}|${s}`)).find((b) => b && b.status === 'booked');
      out.push({ teacher, booking, minutes: sch.slotMinutes, next });
    }
    out.sort((a, b) => (a.teacher.room ?? '').localeCompare(b.teacher.room ?? '', undefined, { numeric: true }) || a.teacher.name.localeCompare(b.teacher.name));
    return { current: out, nextStart };
  }, [settings, bookings, teachers, now, level]);

  // Page through the cards when they don't all fit.
  const pages = Math.max(1, Math.ceil(current.length / perPage));
  useEffect(() => {
    if (pages <= 1) return setPage(0);
    const id = setInterval(() => setPage((p) => (p + 1) % pages), PAGE_MS);
    return () => clearInterval(id);
  }, [pages]);
  const shown = current.slice((page % pages) * perPage, (page % pages + 1) * perPage);

  const eventDay = settings && jakartaDate(now) === settings.eventDate;

  // Text scales with the screen height so it reads from across a hall.
  const sd = level === 'sd';
  return (
    <div className={cx('flex flex-col bg-surface-page', tv ? 'h-dvh overflow-hidden' : 'min-h-dvh')}>
      <main className="flex min-h-0 w-full flex-1 flex-col px-[2vw] py-[2vh]">
        {dummy && (
          <p className="mb-[1.5vh] flex flex-wrap items-center gap-x-3 gap-y-1 self-start rounded-md border border-accent/30 bg-accent-tint px-3 py-1.5 text-sm text-foreground">
            <span className="font-semibold">{t('now_sample')}</span>
            <Link to="/livedummy/sd" className="font-semibold text-action underline-offset-2 hover:underline">
              {t('lvl_sd')}
            </Link>
            <Link to="/livedummy" className="font-semibold text-action underline-offset-2 hover:underline">
              {t('lvl_smp')}
            </Link>
          </p>
        )}
        <header className="mb-[2.5vh] flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
          <div className="flex items-center gap-[1.5vw]">
            <SchoolLogo className="h-[clamp(36px,6vh,84px)]" />
            <div>
              <p className="text-[clamp(13px,1.8vh,24px)] font-bold tracking-wide text-action uppercase">{t(sd ? 'lvl_sd' : 'lvl_smp')}</p>
              <h1 className="text-[clamp(24px,4.2vh,56px)] leading-tight font-extrabold">{t('now_hello')}</h1>
              <p className="text-[clamp(14px,2vh,26px)] text-muted-foreground">{t('now_lead')}</p>
            </div>
          </div>
          <div className="ml-auto text-right">
            <p className="flex items-center justify-end gap-3 text-[clamp(28px,5vh,68px)] leading-none font-extrabold tabular-nums">
              <Clock className="size-[0.8em] text-action" aria-hidden />
              {fmtTime(now)}
            </p>
            <p className="mt-[1vh] flex items-center justify-end gap-2 text-[clamp(13px,1.8vh,24px)] text-muted-foreground">
              <CalendarDays className="size-[1em]" aria-hidden />
              {settings ? fmtDate(settings.eventDate, lang) : ''}
              {simulated && ` · ${t('b_simulated', { time: fmtTime(now) })}`}
            </p>
            <p className="mt-[0.8vh] text-[clamp(14px,2vh,26px)] font-semibold" aria-live="polite">
              {t('now_count', { n: current.length })}
              {pages > 1 && <span className="text-muted-foreground tabular-nums"> · {t('now_page', { p: (page % pages) + 1, n: pages })}</span>}
            </p>
          </div>
        </header>

        {!bookings || !settings ? (
          <div className="grid min-h-0 flex-1 gap-[1.2vw]" style={{ gridTemplateColumns: `repeat(${tv ? grid.cols : 1}, minmax(0, 1fr))` }}>
            {Array.from({ length: tv ? perPage : 3 }, (_, i) => (
              <Skeleton key={i} className="min-h-40 rounded-lg" />
            ))}
          </div>
        ) : !current.length ? (
          <Card className="mx-auto mt-[6vh] max-w-2xl p-[4vh] text-center">
            <p className="text-[clamp(22px,3.6vh,48px)] font-bold">{t('now_none')}</p>
            <p className="mt-2 text-[clamp(16px,2.4vh,32px)] text-muted-foreground">
              {eventDay && Number.isFinite(nextStart) ? t('now_nextAt', { time: fmtTime(nextStart) }) : eventDay ? t('b_ended') : t('b_eventDay', { date: fmtDate(settings.eventDate, lang) })}
            </p>
          </Card>
        ) : (
          <ul
            className={cx('grid gap-[1.2vw]', tv && 'min-h-0 flex-1')}
            style={
              tv
                ? { gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))` }
                : { gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }
            }
          >
            {shown.map(({ teacher, booking, minutes, next }) => (
              <li key={booking.id} className="min-h-0">
                <Card className={'flex h-full flex-col p-[2vh]'}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={cx('font-bold text-action tabular-nums', sd ? 'text-[clamp(16px,3vh,40px)]' : 'text-[clamp(15px,2.5vh,34px)]')}>
                      {fmtRange(booking.slotStart, minutes)}
                    </span>
                    <StatusPill
                      className={sd ? 'text-[clamp(12px,1.8vh,22px)]' : 'text-[clamp(11px,1.5vh,19px)]'}
                      status={booking.status === 'done' ? 'done' : booking.status === 'no_show' ? 'noShow' : 'inProgress'}
                      label={booking.status === 'done' ? t('st_done') : booking.status === 'no_show' ? t('st_noShow') : t('st_inProgress')}
                    />
                  </div>
                  <p
                    className={cx('mt-[1.2vh] line-clamp-2 shrink-0 leading-snug font-bold text-foreground', sd ? 'text-[clamp(17px,3vh,40px)]' : 'text-[clamp(17px,2.9vh,38px)]')}
                    title={teacher.name}
                  >
                    {teacher.name}
                  </p>
                  <p className={cx('mt-[0.8vh] flex shrink-0 items-center gap-2 truncate font-bold text-foreground', sd ? 'text-[clamp(17px,3.2vh,42px)]' : 'text-[clamp(16px,2.7vh,36px)]')}>
                    <MapPin className="size-[0.9em] shrink-0 text-action" aria-hidden />
                    {teacher.room ?? t('roomTbc')}
                  </p>
                  <div className="mt-auto flex items-end justify-between gap-3 border-t border-border-strong pt-[1vh]">
                    <div>
                      <p className="text-[clamp(11px,1.5vh,20px)] text-muted-foreground">{t('done_code')}</p>
                      <p className={cx('font-mono leading-none font-bold tracking-[0.12em] text-foreground', 'text-[clamp(30px,6vh,80px)]')}>
                        {booking.code}
                      </p>
                    </div>
                    {!sd && <p className="pb-1 text-[clamp(13px,2vh,26px)] font-semibold text-muted-foreground">{classLabel(booking.childClass, t)}</p>}
                  </div>
                  <p className="mt-[0.8vh] truncate text-[clamp(11px,1.6vh,21px)] text-muted-foreground">
                    {next ? (
                      <>
                        {t('b_next')}: <span className="font-semibold text-foreground tabular-nums">{fmtTime(next.slotStart)}</span> · {t('now_code', { code: next.code })}
                      </>
                    ) : (
                      t('b_noMore')
                    )}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
