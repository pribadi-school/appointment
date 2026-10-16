/**
 * "Now" screen for the venue TV (admin only): one card per consultation
 * happening right now, with teacher, room and booking code, so parents can
 * find where to go. Cards are grouped by room; when they don't all fit, the
 * screen pages through them every 10 seconds. Updates live and moves on by
 * itself when slots change (each teacher on their own times).
 */
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, Clock, MapPin } from 'lucide-react';
import { Header } from '../components/Header';
import { Button, Card, Field, Notice, Skeleton, StatusPill } from '../components/ui';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useLive, useNow } from '../lib/live';
import { KEYS, load, save } from '../lib/storage';
import { classLabel } from '../lib/teachers';
import { fmtDate, fmtRange, fmtTime, jakartaDate, slotStarts, teacherSchedule } from '../lib/time';
import { errorCode, type Booking, type ErrorCode, type Session, type Teacher } from '../lib/types';

const PAGE_MS = 10_000;

export default function NowPage() {
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
  return session ? <NowScreen token={session.token} onExpired={signOut} /> : <NowLogin onSignIn={signIn} />;
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

function NowScreen({ token, onExpired }: { token: string; onExpired: () => void }) {
  const { t, lang } = useI18n();
  const { settings, teachers, version } = useLive();
  const { now, simulated } = useNow(5_000);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(12);

  const fetchBookings = useCallback(async () => {
    try {
      setBookings(await api.adminBookings(token));
    } catch (e) {
      if (errorCode(e) === 'SESSION_EXPIRED') onExpired();
    }
  }, [token, onExpired]);

  // Live: on every slot change, plus a 15-second safety poll.
  useEffect(() => {
    fetchBookings();
  }, [fetchBookings, version]);
  useEffect(() => {
    const id = setInterval(fetchBookings, 15_000);
    return () => clearInterval(id);
  }, [fetchBookings]);

  // How many cards fit on this screen (cards are ~330 × 250 px).
  useEffect(() => {
    const fit = () => {
      const cols = Math.max(1, Math.floor((window.innerWidth - 32) / 330));
      const rows = Math.max(1, Math.floor((window.innerHeight - 230) / 262));
      setPerPage(cols * rows);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // Consultations in progress right now, each teacher on their own schedule.
  const { current, nextStart } = useMemo(() => {
    const out: Now[] = [];
    let nextStart = Infinity;
    if (!settings || !bookings) return { current: out, nextStart };
    const byKey = new Map(bookings.filter((b) => b.kind === 'booking').map((b) => [`${b.teacherId}|${b.slotStart}`, b]));
    for (const teacher of teachers.filter((x) => x.available)) {
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
  }, [settings, bookings, teachers, now]);

  // Page through the cards when they don't all fit.
  const pages = Math.max(1, Math.ceil(current.length / perPage));
  useEffect(() => {
    if (pages <= 1) return setPage(0);
    const id = setInterval(() => setPage((p) => (p + 1) % pages), PAGE_MS);
    return () => clearInterval(id);
  }, [pages]);
  const shown = current.slice((page % pages) * perPage, (page % pages + 1) * perPage);

  const eventDay = settings && jakartaDate(now) === settings.eventDate;

  return (
    <div className="flex min-h-dvh flex-col">
      <Header title={t('now_title')} wide />
      <main className="mx-auto w-full max-w-[1800px] flex-1 px-4 pt-5 pb-6 xl:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-extrabold xl:text-4xl">
              <Clock className="size-8 text-action" aria-hidden />
              {t('now_title')} · <span className="tabular-nums">{fmtTime(now)}</span>
            </h1>
            <p className="mt-1 flex items-center gap-2 text-base text-muted-foreground">
              <CalendarDays className="size-4" aria-hidden />
              {settings ? fmtDate(settings.eventDate, lang) : ''}
              {simulated && ` · ${t('b_simulated', { time: fmtTime(now) })}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-foreground" aria-live="polite">
              {t('now_count', { n: current.length })}
            </p>
            {pages > 1 && <p className="text-base font-semibold text-muted-foreground tabular-nums">{t('now_page', { p: (page % pages) + 1, n: pages })}</p>}
          </div>
        </div>

        {!bookings || !settings ? (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(310px,1fr))]">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-[240px] rounded-lg" />
            ))}
          </div>
        ) : !current.length ? (
          <Card className="mx-auto mt-10 max-w-xl p-10 text-center">
            <p className="text-2xl font-bold text-foreground">{t('now_none')}</p>
            <p className="mt-2 text-lg text-muted-foreground">
              {eventDay && Number.isFinite(nextStart) ? t('now_nextAt', { time: fmtTime(nextStart) }) : eventDay ? t('b_ended') : t('b_eventDay', { date: fmtDate(settings.eventDate, lang) })}
            </p>
          </Card>
        ) : (
          <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(310px,1fr))]">
            {shown.map(({ teacher, booking, minutes, next }) => (
              <li key={booking.id}>
                <Card className="flex h-full flex-col p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-bold text-action tabular-nums">{fmtRange(booking.slotStart, minutes)}</span>
                    <StatusPill
                      status={booking.status === 'done' ? 'done' : booking.status === 'no_show' ? 'noShow' : 'inProgress'}
                      label={booking.status === 'done' ? t('st_done') : booking.status === 'no_show' ? t('st_noShow') : t('st_inProgress')}
                    />
                  </div>
                  <p className="mt-3 text-xl leading-snug font-bold text-foreground">{teacher.name}</p>
                  {teacher.level === 'sd' && <p className="text-sm text-muted-foreground">{t('sd_teachers')} · {classLabel(teacher.homeroomClass, t)}</p>}
                  <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-foreground">
                    <MapPin className="size-5 shrink-0 text-action" aria-hidden />
                    {teacher.room ?? t('roomTbc')}
                  </p>
                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-border-strong pt-3">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('done_code')}</p>
                      <p className="font-mono text-3xl font-bold tracking-[0.15em] text-foreground">{booking.code}</p>
                    </div>
                    <p className="text-right text-sm text-muted-foreground">{classLabel(booking.childClass, t)}</p>
                  </div>
                  <p className="mt-auto pt-3 text-sm text-muted-foreground">
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
