/**
 * Landing page (the QR code / shared link): a greeting for the parents, then
 * the child's level. Primary School → /sd, Junior–Senior High → /smp-sma.
 */
import { Link } from 'react-router';
import { Backpack, CalendarCheck, CalendarDays, ChevronRight, School } from 'lucide-react';
import { Header } from '../components/Header';
import { Notice, Skeleton, buttonClass } from '../components/ui';
import { useI18n, type MessageKey } from '../lib/i18n';
import { useLive } from '../lib/live';
import { fmtDate } from '../lib/time';
import type { Level } from '../lib/types';

const LEVELS: { level: Level; to: string; title: MessageKey; icon: typeof School }[] = [
  { level: 'sd', to: '/sd', title: 'lvl_sd', icon: Backpack },
  { level: 'smp_sma', to: '/smp-sma', title: 'lvl_smp', icon: School },
];

export function HomePage() {
  const { t, lang } = useI18n();
  const { settings, loading } = useLive();

  return (
    <div className="min-h-dvh">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pt-6 pb-16">
        <h1 className="text-[28px] leading-tight font-bold text-foreground">{t('home_hello')}</h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">{t('home_body')}</p>

        {loading || !settings ? (
          <Skeleton className="mt-4 h-11 rounded-md" />
        ) : (
          <p className="mt-4 flex min-h-11 items-center gap-3 rounded-md border border-border-strong bg-surface px-4 text-base font-semibold text-foreground">
            <CalendarDays className="size-5 shrink-0 text-action" aria-hidden />
            {fmtDate(settings.eventDate, lang)}
          </p>
        )}

        <h2 className="mt-8 mb-3 text-lg font-bold text-foreground">{t('home_choose')}</h2>
        <ul className="divide-y divide-border-strong overflow-hidden rounded-lg border border-border-strong bg-surface sm:grid sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          {LEVELS.map(({ level, to, title, icon: Icon }) => {
            return (
              <li key={level}>
                <Link to={to} className="flex h-full items-center gap-4 px-4 py-4 transition-colors duration-150 hover:bg-surface-page active:bg-surface-muted">
                  <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-md bg-surface-muted text-muted-foreground" aria-hidden>
                    <Icon className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1 text-lg leading-snug font-semibold text-foreground">{t(title)}</span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>

        {settings && !settings.bookingOpen && (
          <div className="mt-4">
            <Notice tone="error">
              <p className="font-semibold">{t('bookingClosedTitle')}</p>
              <p className="mt-0.5">{t('bookingClosedBody')}</p>
            </Notice>
          </div>
        )}

        <div className="mt-10 grid border-t border-border-strong pt-6 sm:flex sm:justify-center">
          <Link to="/my" className={buttonClass('secondary', 'md')}>
            <CalendarCheck className="size-5" aria-hidden />
            {t('nav_mySchedule')}
          </Link>
        </div>
      </main>
    </div>
  );
}
