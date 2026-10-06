/**
 * "My schedule": look up by WhatsApp number + child's name. Remembers the
 * device (localStorage), shows all bookings of the family in time order and
 * lets the parent cancel. Updates live.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { CalendarX2, ChevronLeft, MapPin, MessageCircle, Plus } from 'lucide-react';
import { BottomSheet } from '../components/BottomSheet';
import { Header } from '../components/Header';
import { useToast } from '../components/Toast';
import { Avatar, Button, Card, Field, Notice, Skeleton, StatusPill, buttonClass } from '../components/ui';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useLive, useNow } from '../lib/live';
import { normalizePhone } from '../lib/phone';
import { KEYS, load, save } from '../lib/storage';
import { avatarText, classLabel } from '../lib/teachers';
import { fmtDate, fmtRange, minutesFor, slotState } from '../lib/time';
import { errorCode, type Booking, type ErrorCode, type ParentDetails } from '../lib/types';
import { scheduleMessage, waLink } from '../lib/whatsapp';

export function MySchedulePage() {
  const { t, lang, errorText } = useI18n();
  const toast = useToast();
  const { teachers, settings, version } = useLive();
  const { now } = useNow();
  const stored = load<ParentDetails | null>(KEYS.parent, null);
  const [phone, setPhone] = useState(stored?.phone ?? '');
  const [child, setChild] = useState(stored?.childName ?? '');
  const [query, setQuery] = useState<{ phone: string; child: string } | null>(
    stored?.phone && stored.childName ? { phone: stored.phone, child: stored.childName } : null,
  );
  const [list, setList] = useState<Booking[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [toCancel, setToCancel] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchList = useCallback(
    async (quiet = false) => {
      if (!query) return;
      if (!quiet) setLoading(true);
      setError(null);
      try {
        const found = await api.parentBookings(query.phone, query.child);
        setList(found);
        // Remember this device so next time the schedule opens straight away.
        const mine = found.find((b) => b.childName?.toLowerCase().startsWith(query.child.toLowerCase().split(' ')[0])) ?? found[0];
        if (mine && !load<ParentDetails | null>(KEYS.parent, null)?.phone) {
          save(KEYS.parent, { parentName: mine.parentName ?? '', childName: mine.childName ?? query.child, childClass: mine.childClass ?? '', phone: query.phone });
        }
      } catch (e) {
        setError(errorCode(e));
      } finally {
        setLoading(false);
      }
    },
    [query],
  );

  useEffect(() => {
    fetchList();
  }, [fetchList]);
  // Live: refresh quietly when any slot changes (e.g. admin moved a booking).
  useEffect(() => {
    if (version) fetchList(true);
  }, [version, fetchList]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!normalizePhone(phone)) {
      setPhoneError(t('v_phone'));
      return;
    }
    setPhoneError(null);
    setQuery({ phone: phone.trim(), child: child.trim() });
  };

  const confirmCancel = async () => {
    if (!toCancel || !query) return;
    setCancelling(true);
    try {
      await api.parentCancel(toCancel.id, query.phone, query.child);
      toast(t('my_cancelled'), 'success');
      setList((l) => l?.filter((b) => b.id !== toCancel.id) ?? null);
      setToCancel(null);
    } catch (e) {
      toast(errorText(errorCode(e)), 'error');
      setToCancel(null);
      fetchList(true);
    } finally {
      setCancelling(false);
    }
  };

  const byId = new Map(teachers.map((x) => [x.id, x]));
  const showLookup = !query || (list && list.length === 0 && !loading);
  const teacherName = (b: Booking) => byId.get(b.teacherId)?.name ?? '-';
  // SD and SMP–SMA slots have different lengths.
  const minutesOf = (b: Booking) => (settings ? minutesFor(settings, byId.get(b.teacherId)?.level ?? 'smp_sma') : 10);

  return (
    <div className="min-h-dvh">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pt-5 pb-16">
        <h1 className="text-2xl font-bold">{t('my_title')}</h1>

        {showLookup && (
          <>
            {query && list?.length === 0 && (
              <div className="mt-4">
                <Notice tone="info">{t('my_none')}</Notice>
              </div>
            )}
            <p className="mt-2 mb-5 text-base text-muted-foreground">{t('my_intro')}</p>
            <form onSubmit={submit} className="space-y-5" noValidate>
              <Field
                label={t('f_phone')}
                placeholder={t('f_phonePh')}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                error={phoneError}
              />
              <Field label={t('f_childName')} placeholder={t('f_childNamePh')} value={child} onChange={(e) => setChild(e.target.value)} />
              <Button type="submit" block disabled={!phone.trim() || child.trim().length < 2}>
                {t('my_find')}
              </Button>
            </form>
          </>
        )}

        {error && (
          <div className="mt-4">
            <Notice tone="error" action={<Button size="sm" variant="ghost" onClick={() => fetchList()}>{t('retry')}</Button>}>
              {errorText(error)}
            </Notice>
          </div>
        )}

        {query && loading && !list && (
          <div className="mt-5 space-y-3">
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </div>
        )}

        {query && list && list.length > 0 && settings && (
          <>
            <p className="mt-1 text-base text-muted-foreground">
              {t('my_count', { n: list.length, date: fmtDate(settings.eventDate, lang, { weekday: undefined }) })}
            </p>
            <ol className="mt-5 space-y-3">
              {list.map((b) => {
                const teacher = byId.get(b.teacherId);
                const st = b.status === 'no_show' ? 'noShow' : slotState({ status: b.status === 'done' ? 'done' : 'taken' }, b.slotStart, minutesOf(b), now);
                const canCancel = b.status === 'booked' && b.slotStart > now;
                return (
                  <Card as="li" key={b.id} className="p-4 animate-step-in">
                    <div className="flex items-start gap-3">
                      <div className="w-[68px] shrink-0">
                        <p className="text-xl leading-tight font-extrabold text-action tabular-nums">{fmtRange(b.slotStart, minutesOf(b)).split(' – ')[0]}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">– {fmtRange(b.slotStart, minutesOf(b)).split(' – ')[1]}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-foreground">{teacher?.name ?? '-'}</p>
                          <StatusPill
                            status={st === 'taken' ? 'available' : st}
                            label={
                              st === 'taken' ? t('my_upcoming') : st === 'inProgress' ? t('st_inProgress') : st === 'noShow' ? t('st_noShow') : t('st_done')
                            }
                          />
                        </div>
                        {(teacher?.subject || teacher?.level === 'sd') && (
                          <p className="text-sm text-muted-foreground">{teacher.subject ?? t('sd_teachers')}</p>
                        )}
                        <p className="mt-1.5 flex items-center gap-1 text-sm font-semibold text-foreground">
                          <MapPin className="size-4 text-muted-foreground" aria-hidden />
                          {teacher?.room ?? t('roomTbc')}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          <span className="font-semibold text-accent">{b.childName}</span> ({classLabel(b.childClass, t)}) · {t('my_code', { code: b.code })}
                        </p>
                      </div>
                    </div>
                    {canCancel && (
                      <div className="mt-3 flex justify-end border-t border-border pt-3">
                        <Button size="sm" variant="ghost" className="!text-destructive" onClick={() => setToCancel(b)}>
                          <CalendarX2 className="size-4" aria-hidden />
                          {t('my_cancel')}
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </ol>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link to="/" className={buttonClass('primary', 'md', true)}>
                <Plus className="size-5" aria-hidden />
                {t('my_bookMore')}
              </Link>
              <a
                href={waLink(normalizePhone(query.phone), scheduleMessage(lang, list, teachers, settings))}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass('secondary', 'md', true)}
              >
                <MessageCircle className="size-5" aria-hidden />
                {t('done_wa')}
              </a>
            </div>
            <button
              type="button"
              onClick={() => {
                setQuery(null);
                setList(null);
              }}
              className="mx-auto mt-5 block text-sm font-semibold text-action hover:underline"
            >
              {t('my_other')}
            </button>
          </>
        )}

        {/* Always a clear way back to the start (greeting + level choice). */}
        <div className="mt-10 border-t border-border-strong pt-6">
          <Link to="/" className={buttonClass('secondary', 'md', true)}>
            <ChevronLeft className="size-5" aria-hidden />
            {t('backHome')}
          </Link>
        </div>
      </main>

      <BottomSheet
        open={Boolean(toCancel)}
        onClose={() => setToCancel(null)}
        title={t('my_cancelTitle')}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" block onClick={() => setToCancel(null)} data-autofocus>
              {t('my_keep')}
            </Button>
            <Button variant="danger" block loading={cancelling} onClick={confirmCancel}>
              {t('my_yesCancel')}
            </Button>
          </div>
        }
      >
        {toCancel && settings && (
          <div className="flex items-center gap-3">
            <Avatar text={avatarText(byId.get(toCancel.teacherId))} />
            <p className="text-base text-foreground">
              {t('my_cancelBody', { teacher: teacherName(toCancel), time: fmtRange(toCancel.slotStart, minutesOf(toCancel)) })}
            </p>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
