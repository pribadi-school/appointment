/** Sticky app header: school mark, title, Live indicator and EN | ID toggle. */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useLive } from '../lib/live';
import { buttonClass, cx } from './ui';

export function LiveIndicator({ className }: { className?: string }) {
  const { t } = useI18n();
  const { connected } = useLive();
  return (
    <span
      className={cx('inline-flex items-center gap-1.5 text-xs font-semibold', connected ? 'text-foreground' : 'text-muted-foreground', className)}
      role="status"
      aria-label={connected ? `${t('live')}. ${t('liveHelp')}` : t('reconnecting')}
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
    <div role="group" aria-label={t('langLabel')} className="inline-flex rounded-md border border-border-strong p-0.5 text-xs font-bold">
      {(['en', 'id'] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          lang={l}
          aria-label={l === 'en' ? 'English' : 'Bahasa Indonesia'}
          onClick={() => setLang(l)}
          className={cx(
            'h-9 min-w-10 rounded-sm px-2 transition-[background-color,color] duration-150',
            lang === l ? 'bg-action text-on-primary' : 'text-muted-foreground hover:bg-surface-page hover:text-foreground',
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
      <header className="no-print sticky top-0 z-40 border-b border-border-strong bg-surface">
        <div className={cx('mx-auto flex h-16 items-center gap-3 px-4 sm:h-[72px] sm:gap-5 sm:px-6', wide ? 'max-w-[1600px]' : 'max-w-3xl')}>
          <Link to="/" className="flex min-w-0 items-center gap-3 rounded-md py-2" aria-label={`${t('school')}, ${t('appName')}`}>
            <SchoolLogo className="h-7 sm:h-8" />
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

/**
 * Fixed bottom action bar (native-app style): solid surface with a top border, safe-area aware.
 * `backTo` (a link) or `onBack` adds a "Back" button beside the main action, within thumb reach,
 * so parents who are unsure where they are can always step back.
 */
export function StickyBar({ children, backTo, onBack }: { children?: ReactNode; backTo?: string; onBack?: () => void }) {
  const { t } = useI18n();
  const backClass = cx(buttonClass('secondary', 'md'), children ? 'shrink-0 px-4' : 'w-full');
  const back = backTo ? (
    <Link to={backTo} className={backClass}>
      <ChevronLeft className="size-5" aria-hidden />
      {t('back')}
    </Link>
  ) : onBack ? (
    <button type="button" onClick={onBack} className={backClass}>
      <ChevronLeft className="size-5" aria-hidden />
      {t('back')}
    </button>
  ) : null;
  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border-strong bg-surface pt-3">
      <div className="mx-auto flex max-w-3xl gap-2 px-4 pb-safe">
        {back}
        {children && <div className="min-w-0 flex-1">{children}</div>}
      </div>
    </div>
  );
}
