/**
 * Teacher view: pick your name, enter the shared teacher PIN, see your own consultations
 * with parent details. Mark Done / No-show on the day. The current slot is
 * highlighted from the clock and scrolled into view.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Ban, Check, ChevronDown, MapPin, MessageCircle, Search, Users, UserX } from 'lucide-react';
import { BottomSheet } from '../components/BottomSheet';
import { Header } from '../components/Header';
import { useToast } from '../components/Toast';
import { Avatar, Button, Card, Field, Notice, PulseDot, Skeleton, StatusPill, cx } from '../components/ui';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useLive, useNow } from '../lib/live';
import { formatPhone } from '../lib/phone';
import { KEYS, load, save } from '../lib/storage';
import { initials } from '../lib/teachers';
import { currentSlotIndex, fmtRange, slotStarts } from '../lib/time';
import { errorCode, type Booking, type ErrorCode, type Session } from '../lib/types';
import { waLink } from '../lib/whatsapp';

export default function TeacherPage() {
  const [session, setSession] = useState<Session | null>(() => {
    const s = load<Session | null>(KEYS.teacherSession, null);
    return s && s.expiresAt > Date.now() ? s : null;
  });
  const signIn = (s: Session) => {
    save(KEYS.teacherSession, s);
    setSession(s);
  };
  const signOut = useCallback(() => {
    if (session) api.logout(session.token).catch(() => {});
    save(KEYS.teacherSession, null);
    setSession(null);
  }, [session]);
  return session ? <TeacherSchedule session={session} onSignOut={signOut} /> : <TeacherLogin onSignIn={signIn} />;
}

function TeacherLogin({ onSignIn }: { onSignIn: (s: Session) => void }) {
  const { t, errorText } = useI18n();
  const { teachers, loading } = useLive();
  const [teacherId, setTeacherId] = useState<string | null>(() => load<string | null>(KEYS.lastTeacher, null));
  const [sheet, setSheet] = useState(false);
  const [query, setQuery] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const teacher = teachers.find((x) => x.id === teacherId);
  const list = teachers.filter((x) => !query || x.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!teacherId) return setSheet(true);
    setBusy(true);
    setError(null);
    try {
      const s = await api.teacherLogin(teacherId, pin);
      save(KEYS.lastTeacher, teacherId);
      onSignIn({ ...s, teacherId });
    } catch (err) {
      setError(errorCode(err));
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <Header title={t('nav_teacher')} />
      <main className="mx-auto max-w-md px-4 pt-8 pb-16">
        <h1 className="text-2xl font-bold">{t('tv_title')}</h1>
        <p className="mt-1 mb-6 text-[15px] text-muted-foreground">{t('tv_intro')}</p>
        <form onSubmit={submit} className="space-y-5">
          <div>
            <span id="tname" className="mb-1.5 block text-sm font-semibold text-foreground">
              {t('tv_name')}
            </span>
            <button
              type="button"
              aria-labelledby="tname tname-v"
              aria-haspopup="dialog"
              onClick={() => setSheet(true)}
              disabled={loading}
              className="flex h-12 w-full items-center justify-between gap-2 rounded-md bg-surface px-4 text-left ring-1 ring-border-strong hover:ring-action"
            >
              <span id="tname-v" className={cx('truncate', teacher ? 'font-semibold text-foreground' : 'text-muted-foreground/70')}>
                {teacher?.name ?? t('tv_chooseName')}
              </span>
              <ChevronDown className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </div>
          <Field
            label={t('tv_pin')}
            hint={t('tv_pinHint')}
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={10}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="[&_input]:text-center [&_input]:text-xl [&_input]:tracking-[0.4em]"
          />
          {error && <Notice tone="error">{errorText(error)}</Notice>}
          <Button type="submit" block loading={busy} disabled={!teacherId || pin.length < 4}>
            {t('tv_signIn')}
          </Button>
        </form>

        <div className="mt-10 flex justify-center border-t border-border pt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-5 py-2.5 text-[15px] font-semibold text-foreground hover:bg-surface-muted"
          >
            <Users className="size-5" aria-hidden />
            {t('imParent')}
          </Link>
        </div>
      </main>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title={t('tv_chooseName')}>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('tv_searchNames')}
            aria-label={t('tv_searchNames')}
            className="h-11 w-full rounded-full bg-surface-page pr-3 pl-9 text-base outline-none focus:ring-2 focus:ring-action"
          />
        </div>
        <ul className="-mx-2">
          {list.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                onClick={() => {
                  setTeacherId(x.id);
                  setSheet(false);
                  setError(null);
                }}
                className={cx('flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-surface-page', x.id === teacherId && 'bg-action-tint')}
              >
                <Avatar text={initials(x.name)} size="sm" muted={!x.available} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">{x.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{x.subject ?? x.role ?? ''}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </div>
  );
}

function TeacherSchedule({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const { t, errorText } = useI18n();
  const toast = useToast();
  const { teachers, settings, version } = useLive();
  const { now } = useNow(15_000);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const currentRow = useRef<HTMLLIElement>(null);
  const scrolled = useRef(false);
  const teacher = teachers.find((x) => x.id === session.teacherId);

  const fetchSchedule = useCallback(async () => {
    try {
      setBookings(await api.teacherSchedule(session.token));
      setError(null);
    } catch (e) {
      const code = errorCode(e);
      if (code === 'SESSION_EXPIRED') {
        toast(errorText(code), 'error');
        onSignOut();
      } else setError(code);
    }
  }, [session.token, onSignOut, toast, errorText]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule, version]);

  const starts = useMemo(() => (settings ? slotStarts(settings) : []), [settings]);
  const minutes = settings?.slotMinutes ?? 10;
  const current = currentSlotIndex(starts, minutes, now);
  const byStart = useMemo(() => new Map((bookings ?? []).map((b) => [b.slotStart, b])), [bookings]);

  useEffect(() => {
    if (bookings && !scrolled.current && currentRow.current) {
      scrolled.current = true;
      currentRow.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [bookings, current]);

  const setStatus = async (b: Booking, status: Booking['status']) => {
    setPending(b.id);
    // Optimistic update so the button feels instant.
    setBookings((list) => list?.map((x) => (x.id === b.id ? { ...x, status } : x)) ?? null);
    try {
      await api.teacherSetStatus(session.token, b.id, status);
    } catch (e) {
      toast(errorText(errorCode(e)), 'error');
      fetchSchedule();
    } finally {
      setPending(null);
    }
  };

  const real = (bookings ?? []).filter((b) => b.kind === 'booking');
  const doneCount = real.filter((b) => b.status !== 'booked').length;

  return (
    <div className="min-h-dvh">
      <Header
        title={t('nav_teacher')}
        right={
          <button type="button" onClick={onSignOut} className="inline-flex h-9 items-center justify-center rounded-full border border-border-strong px-4 text-sm font-semibold text-foreground hover:bg-surface-page">
            {t('tv_signOut')}
          </button>
        }
      />
      <main className="mx-auto max-w-3xl px-4 pt-5 pb-16">
        <Card className="mb-5 flex items-center gap-3 p-4">
          <Avatar text={initials(teacher?.name ?? '?')} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold">{teacher?.name}</h1>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden />
              {teacher?.room ?? t('roomTbc')}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{t('tv_summary', { booked: real.length, done: doneCount })}</p>
          </div>
        </Card>

        {error && <Notice tone="error" action={<Button size="sm" variant="ghost" onClick={fetchSchedule}>{t('retry')}</Button>}>{errorText(error)}</Notice>}

        {!bookings || !settings ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : (
          <ol className="space-y-2">
            {starts.map((s, i) => {
              const b = byStart.get(s);
              const isNow = i === current;
              const past = s + minutes * 60_000 <= now;
              return (
                <li
                  key={s}
                  ref={isNow ? currentRow : undefined}
                  aria-current={isNow ? 'time' : undefined}
                  className={cx(
                    'flex items-start gap-3 rounded-lg bg-surface px-3 ring-1 transition-shadow duration-250',
                    b?.kind === 'booking' ? 'py-3' : 'py-2',
                    isNow ? 'shadow-e3 ring-2 ring-gradient-end' : 'shadow-e1 ring-border',
                    past && !isNow && 'opacity-75',
                  )}
                >
                  <div className="w-[62px] shrink-0 pt-0.5">
                    <p className={cx('text-[15px] font-extrabold tabular-nums', isNow ? 'text-foreground' : 'text-action')}>{fmtRange(s, minutes).split(' – ')[0]}</p>
                    {isNow && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-foreground uppercase">
                        <PulseDot /> {t('tv_now')}
                      </p>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {!b ? (
                      <p className="pt-0.5 text-sm text-muted-foreground">{t('tv_free')}</p>
                    ) : b.kind === 'blocked' ? (
                      <p className="flex items-center gap-1.5 pt-0.5 text-sm font-semibold text-muted-foreground">
                        <Ban className="size-4" aria-hidden />
                        {t('tv_blocked')}
                        {b.note ? ` · ${b.note}` : ''}
                      </p>
                    ) : (
                      <>
                        <p className="font-bold text-foreground">
                          {b.childName} <span className="font-semibold text-muted-foreground">· {b.childClass}</span>
                        </p>
                        <p className="text-[13px] text-muted-foreground">{b.parentName}</p>
                        {b.phone ? (
                          <a href={waLink(b.phone)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-action hover:underline" aria-label={`${t('tv_chat')}: ${formatPhone(b.phone)}`}>
                            <MessageCircle className="size-3.5" aria-hidden />
                            {formatPhone(b.phone)}
                          </a>
                        ) : (
                          <p className="mt-1 text-[13px] text-muted-foreground">{t('tv_noPhone')}</p>
                        )}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          {b.status === 'booked' ? (
                            <>
                              <Button size="sm" onClick={() => setStatus(b, 'done')} disabled={pending === b.id} icon={<Check className="size-4" aria-hidden />}>
                                {t('tv_done')}
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => setStatus(b, 'no_show')} disabled={pending === b.id} icon={<UserX className="size-4" aria-hidden />}>
                                {t('tv_noShow')}
                              </Button>
                            </>
                          ) : (
                            <>
                              <StatusPill status={b.status === 'done' ? 'done' : 'noShow'} label={b.status === 'done' ? t('st_done') : t('st_noShow')} />
                              <Button size="sm" variant="ghost" onClick={() => setStatus(b, 'booked')} disabled={pending === b.id}>
                                {t('tv_undo')}
                              </Button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </main>
    </div>
  );
}
