/**
 * Header menu (hamburger): parents' pages plus staff sign-in (Teacher, Admin).
 * The live board is left out on purpose: it's for the venue screen, opened by
 * the admin from its link (Admin → QR code), not something parents need.
 * Opens a panel under the header; closes on Esc, on a tap outside, or when a
 * link is followed. The current page is marked.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { CalendarCheck, GraduationCap, House, Menu, ShieldCheck, X } from 'lucide-react';
import { useI18n, type MessageKey } from '../lib/i18n';
import { cx } from './ui';

const LINKS: { to: string; label: MessageKey; icon: typeof House; group: 'parents' | 'staff' }[] = [
  { to: '/', label: 'nav_book', icon: House, group: 'parents' },
  { to: '/my', label: 'nav_mySchedule', icon: CalendarCheck, group: 'parents' },
  { to: '/teacher', label: 'nav_teacher', icon: GraduationCap, group: 'staff' },
  { to: '/admin', label: 'nav_admin', icon: ShieldCheck, group: 'staff' },
];

export function NavMenu() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  // Close when the page changes.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  // The booking flow lives under "/" too (/sd, /smp-sma).
  const isCurrent = (to: string) => (to === '/' ? ['/', '/sd', '/smp-sma'].includes(pathname) : pathname.startsWith(to));

  return (
    <div ref={root}>
      <button
        ref={button}
        type="button"
        aria-label={t('nav_menu')}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          'inline-flex size-11 items-center justify-center rounded-md border transition-colors duration-150',
          open ? 'border-action bg-action-tint text-action' : 'border-border-strong text-foreground hover:bg-surface-page',
        )}
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>
      {open && (
        <nav
          id={panelId}
          aria-label={t('nav_menu')}
          className="absolute inset-x-0 top-full border-b border-border-strong bg-surface shadow-e4 animate-fade-in sm:right-4 sm:left-auto sm:mt-2 sm:w-72 sm:rounded-lg sm:border"
        >
          {(['parents', 'staff'] as const).map((group) => (
            <div key={group} className="border-b border-border-strong px-2 py-2 last:border-b-0">
              <p className="px-3 pt-1 pb-1.5 text-sm font-semibold text-muted-foreground">{t(group === 'parents' ? 'nav_forParents' : 'nav_forStaff')}</p>
              <ul>
                {LINKS.filter((l) => l.group === group).map(({ to, label, icon: Icon }) => {
                  const current = isCurrent(to);
                  return (
                    <li key={to}>
                      <Link
                        to={to}
                        aria-current={current ? 'page' : undefined}
                        className={cx(
                          'flex min-h-12 items-center gap-3 rounded-md px-3 text-base font-semibold transition-colors duration-150',
                          current ? 'bg-action-tint text-action' : 'text-foreground hover:bg-surface-page',
                        )}
                      >
                        <Icon className={cx('size-5 shrink-0', current ? 'text-action' : 'text-muted-foreground')} aria-hidden />
                        {t(label)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      )}
    </div>
  );
}
