/**
 * Bottom sheet on phones, centred dialog on tablet/desktop.
 * Accessible: role=dialog, focus is trapped inside, Esc closes, focus returns
 * to the element that opened it, page behind does not scroll.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { cx } from './ui';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
};

export function BottomSheet({ open, onClose, title, children, footer, size = 'md' }: Props) {
  const { t } = useI18n();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    // Focus the first field, or the panel itself.
    requestAnimationFrame(() => {
      const first = panel.current?.querySelector<HTMLElement>('[data-autofocus], input, select, textarea');
      (first ?? panel.current)?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key !== 'Tab' || !panel.current) return;
      const items = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="sheet-root fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-overlay animate-fade-in" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'relative flex max-h-[88dvh] w-full flex-col bg-surface shadow-e4 outline-none',
          'rounded-t-xl animate-sheet-up sm:rounded-xl sm:animate-step-in',
          size === 'md' ? 'sm:max-w-md' : 'sm:max-w-2xl',
        )}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-border-strong sm:hidden" aria-hidden />
        <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-2 sm:pt-5">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="-mr-2 inline-flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-page"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
        {footer && <div className="border-t border-border px-5 pt-3 pb-safe">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
