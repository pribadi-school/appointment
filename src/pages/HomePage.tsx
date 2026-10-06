/**
 * Landing page (the QR code / shared link): a greeting for the parents, then
 * the child's level. Primary School → /sd, Junior–Senior High → /smp-sma.
 */
import { Link } from 'react-router';
import { Backpack, CalendarCheck, CalendarDays, ChevronRight, GraduationCap, School } from 'lucide-react';
import { Header } from '../components/Header';
import { Notice, Skeleton, buttonClass } from '../components/ui';
import { useI18n, type MessageKey } from '../lib/i18n';
import { useLive } from '../lib/live';
import { fmtDate, scheduleFor } from '../lib/time';
import type { Level } from '../lib/types';

const LEVELS: { level: Level; to: string; title: MessageKey; sub: MessageKey; icon: typeof School }[] = [
  { level: 'sd', to: '/sd', title: 'lvl_sd', sub: 'lvl_sdSub', icon: Backpack },
  { level: 'smp_sma', to: '/smp-sma', title: 'lvl_smp', sub: 'lvl_smpSub', icon: School },
];

export function HomePage() {
  const { t, lang } = useI18n();
  const { settings, loading } = useLive();

  return (
    <div className="min-h-dvh">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pt-5 pb-16">
        <h1 className="text-[26px] leading-tight font-extrabold text-foreground">{t('home_hello')}</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">{t('home_body')}</p>

        {loading || !settings ? (
          <Skeleton className="mt-4 h-6 w-56 rounded-md" />
        ) : (
          <p className="mt-3 flex items-center gap-2 text-sm font-bold text-foreground">
            <CalendarDays className="size-4 text-action" aria-hidden />
            {fmtDate(settings.eventDate, lang)}
          </p>
        )}

        <h2 className="mt-6 mb-3 text-lg font-bold text-foreground">{t('home_choose')}</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {LEVELS.map(({ level, to, title, sub, icon: Icon }) => {
            const sch = settings ? scheduleFor(settings, level) : null;
            return (
              <li key={level}>
                <Link
                  to={to}
                  className="group flex items-center gap-3.5 rounded-lg bg-surface p-4 shadow-e1 ring-1 ring-border transition-[box-shadow,transform] duration-250 hover:-translate-y-0.5 hover:shadow-e3 active:scale-[0.99]"
                >
                  <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-linear-135 from-gradient-start to-gradient-end text-on-primary shadow-e1" aria-hidden>
                    <Icon className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] leading-snug font-bold text-foreground">{t(title)}</span>
                    <span className="block text-[13px] font-medium text-muted-foreground">{t(sub)}</span>
                    {sch && (
                      <span className="mt-0.5 block text-[12px] text-muted-foreground tabular-nums">
                        {t('lvl_times', { start: sch.dayStart.replace(':', '.'), end: sch.dayEnd.replace(':', '.'), n: sch.slotMinutes })}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-action transition-transform duration-250 group-hover:translate-x-0.5" aria-hidden />
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

        <div className="mt-8 flex flex-wrap justify-center gap-3 border-t border-border pt-6">
          <Link to="/my" className={buttonClass('secondary', 'md')}>
            <CalendarCheck className="size-5" aria-hidden />
            {t('nav_mySchedule')}
          </Link>
          <Link to="/teacher" className={buttonClass('ghost', 'md')}>
            <GraduationCap className="size-5" aria-hidden />
            {t('imTeacher')}
          </Link>
        </div>
      </main>
    </div>
  );
}
