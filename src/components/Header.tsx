/** Sticky app header: school mark, title, Live indicator and EN | ID toggle. */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useLive } from '../lib/live';
import { cx } from './ui';

export function LiveIndicator({ className }: { className?: string }) {
  const { t } = useI18n();
  const { connected } = useLive();
  return (
    <span
      className={cx('inline-flex items-center gap-1.5 text-xs font-semibold', connected ? 'text-foreground' : 'text-muted-foreground', className)}
      role="status"
      aria-label={connected ? `${t('live')} — ${t('liveHelp')}` : t('reconnecting')}
      title={connected ? t('liveHelp') : t('reconnecting')}
    >
      <span className="relative inline-flex size-2" aria-hidden>
        {connected && <span className="absolute inline-flex size-full rounded-full bg-live animate-live-ping" />}
        <span className={cx('relative inline-flex size-2 rounded-full', connected ? 'bg-live' : 'bg-muted-foreground')} />
      </span>
      <span className={cx(!connected && 'hidden sm:inline')}>{connected ? t('live') : t('reconnecting')}</span>
    </span>
  );
}

export function LangToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <div role="group" aria-label={t('langLabel')} className="inline-flex rounded-full bg-surface-muted p-0.5 text-xs font-bold">
      {(['en', 'id'] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          lang={l}
          aria-label={l === 'en' ? 'English' : 'Bahasa Indonesia'}
          onClick={() => setLang(l)}
          className={cx(
            'h-7 min-w-9 rounded-full px-2 transition-[background-color,color,box-shadow] duration-250',
            lang === l ? 'bg-surface text-foreground shadow-e1' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** School logo (SD-SMP-SMA Pribadi, Depok 1995). Replaces the old "P" badge. */
export function SchoolLogo({ className }: { className?: string }) {
  return (
    <img
      src="/pribadi-red.png"
      alt="SD-SMP-SMA Pribadi Depok"
      width={900}
      height={252}
      className={cx('w-auto shrink-0', className ?? 'h-9')}
    />
  );
}

export function Header({ title, right, wide }: { title?: string; right?: ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  return (
    <>
      {api.mode === 'demo' && (
        <div className="no-print bg-foreground px-4 py-1.5 text-center text-[12px] font-medium text-on-primary">{t('demoBanner')}</div>
      )}
      <header className="no-print sticky top-0 z-40 border-b border-border bg-surface/90 shadow-sm backdrop-blur-md">
        <div className={cx('mx-auto flex min-h-20 items-center gap-4 px-5 py-4 sm:min-h-24 sm:gap-5 sm:px-8 sm:py-5', wide ? 'max-w-[1600px]' : 'max-w-3xl')}>
          <Link to="/" className="flex min-w-0 items-center gap-3 rounded-md" aria-label={`${t('school')} — ${t('appName')}`}>
            <SchoolLogo className="h-8 sm:h-9" />
            {/* Sub-pages (Live board, Admin …) show their name next to the logo from tablet width up. */}
            {title && (
              <span className="hidden min-w-0 border-l border-border-strong pl-4 text-base font-bold text-foreground sm:block">
                <span className="block truncate">{title}</span>
              </span>
            )}
          </Link>
          <div className="ml-auto flex items-center gap-2.5">
            {right}
            <LiveIndicator />
            <LangToggle />
          </div>
        </div>
      </header>
    </>
  );
}

/** Fixed bottom action area (native-app style). Content gets bottom padding via .pb-sticky. */
export function StickyBar({ children }: { children: ReactNode }) {
  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-30 bg-linear-to-t from-surface-page via-surface-page/95 to-surface-page/0 pt-6">
      <div className="mx-auto max-w-3xl px-4 pb-safe">{children}</div>
    </div>
  );
}
