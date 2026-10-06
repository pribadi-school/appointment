/**
 * Small building blocks styled from MASTER.md tokens: pill buttons with the
 * neutral elevation scale, raised cards, form fields, skeletons, status pills.
 */
import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
};

/** Button look, shared by <button>, <a> and router <Link>. */
export function buttonClass(variant: ButtonProps['variant'] = 'primary', size: ButtonProps['size'] = 'md', block?: boolean) {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-md font-semibold select-none text-center',
    'transition-[background-color,color,border-color] duration-150 ease-standard',
    'disabled:cursor-not-allowed',
    size === 'md' ? 'min-h-12 px-5 py-2 text-base' : 'min-h-11 px-4 py-1.5 text-sm',
    block && 'w-full',
    variant === 'primary' &&
      'bg-action text-on-primary [&:not(:disabled)]:hover:bg-action-hover [&:not(:disabled)]:active:bg-action-hover disabled:bg-surface-muted disabled:text-muted-foreground',
    variant === 'secondary' &&
      'border border-border-strong bg-surface text-action [&:not(:disabled)]:hover:bg-action-tint [&:not(:disabled)]:active:bg-action-tint disabled:text-muted-foreground',
    variant === 'ghost' && 'text-action [&:not(:disabled)]:hover:bg-action-tint [&:not(:disabled)]:active:bg-action-tint disabled:text-muted-foreground',
    variant === 'danger' &&
      'border border-destructive/40 bg-surface text-destructive [&:not(:disabled)]:hover:bg-destructive-tint [&:not(:disabled)]:active:bg-destructive-tint disabled:opacity-60',
  );
}

/** Flat button: solid fill or 1px border, 8px corners; hover/press change colour only (no movement). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, block, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonClass(variant, size, block), className)}
      {...rest}
    >
      {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function Card({ className, children, as: As = 'div' }: { className?: string; children: ReactNode; as?: 'div' | 'section' | 'li' }) {
  return <As className={cx('rounded-lg border border-border-strong bg-surface', className)}>{children}</As>;
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null; trailing?: ReactNode };

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, hint, error, trailing, className, ...rest }, ref) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cx(
            'h-12 w-full rounded-md border bg-surface px-4 text-base text-foreground placeholder:text-muted-foreground',
            'transition-[border-color,box-shadow] duration-150 outline-none focus:border-action focus:ring-1 focus:ring-action',
            error ? 'border-destructive' : 'border-border-strong',
            trailing ? 'pr-12' : '',
          )}
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 right-2 flex items-center">{trailing}</div>}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && <FieldError id={`${id}-err`}>{error}</FieldError>}
    </div>
  );
});

/** Native <select> styled like Field (best on phones: uses the OS picker). */
export function SelectField({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-md border border-border-strong bg-surface px-3 text-base text-foreground outline-none focus:border-action focus:ring-1 focus:ring-action"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-destructive">
      <AlertCircle className="mt-px size-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} aria-hidden />;
}

/** Friendly inline message box. */
export function Notice({ tone = 'info', children, action }: { tone?: 'info' | 'error' | 'success'; children: ReactNode; action?: ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'flex items-start gap-3 rounded-md border px-4 py-3 text-base animate-fade-in',
        tone === 'error' && 'border-destructive/30 bg-destructive-tint text-foreground',
        tone === 'info' && 'border-action/20 bg-action-tint text-foreground',
        tone === 'success' && 'border-gradient-end/30 bg-status-progress-bg text-foreground',
      )}
    >
      {tone === 'error' ? (
        <AlertCircle className="mt-0.5 size-[18px] shrink-0 text-destructive" aria-hidden />
      ) : tone === 'success' ? (
        <Check className="mt-0.5 size-[18px] shrink-0 text-gradient-end" aria-hidden />
      ) : (
        <AlertCircle className="mt-0.5 size-[18px] shrink-0 text-action" aria-hidden />
      )}
      <div className="flex-1">{children}</div>
      {action}
    </div>
  );
}

export type Status = 'available' | 'taken' | 'inProgress' | 'done' | 'passed' | 'noShow' | 'blocked';

/** Status pill used everywhere a slot state is shown. Text + colour + icon. */
export function StatusPill({ status, label, className }: { status: Status; label: string; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-semibold whitespace-nowrap',
        status === 'available' && 'bg-status-available-bg text-status-available-fg ring-1 ring-status-available-border',
        (status === 'taken' || status === 'blocked') && 'bg-status-taken-bg text-status-taken-fg',
        status === 'inProgress' && 'bg-status-progress-bg text-status-progress-fg ring-1 ring-gradient-end/40',
        (status === 'done' || status === 'passed') && 'bg-status-done-bg text-status-done-fg ring-1 ring-border-strong',
        status === 'noShow' && 'bg-accent-tint text-foreground ring-1 ring-accent/30',
        className,
      )}
    >
      {status === 'inProgress' && <PulseDot />}
      {status === 'done' && <Check className="size-3.5" aria-hidden />}
      {label}
    </span>
  );
}

export function PulseDot({ className }: { className?: string }) {
  return (
    <span className={cx('relative inline-flex size-2', className)} aria-hidden>
      <span className="absolute inline-flex size-full rounded-full bg-status-progress-dot animate-live-ping" />
      <span className="relative inline-flex size-2 rounded-full bg-status-progress-dot" />
    </span>
  );
}

/** iOS-style switch, keyboard accessible. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-250',
        checked ? 'bg-action' : 'bg-border-strong',
        disabled && 'opacity-50',
      )}
    >
      <span
        className={cx(
          'inline-block size-5 rounded-full bg-surface transition-transform duration-150 ease-out-cubic',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}

/** Segmented control (tabs). */
export function Segmented<V extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: V;
  onChange: (v: V) => void;
  options: { value: V; label: ReactNode }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('inline-flex rounded-md border border-border-strong bg-surface-muted p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-10 rounded-sm px-3.5 text-sm font-semibold transition-[background-color,color] duration-150',
            value === o.value ? 'bg-surface text-foreground ring-1 ring-border-strong' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Flat badge with initials (or an SD grade number): tinted square, brand-blue text. */
export function Avatar({ text, size = 'md', muted }: { text: string; size?: 'sm' | 'md' | 'lg'; muted?: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-md font-bold',
        muted ? 'bg-surface-muted text-muted-foreground' : 'bg-action-tint text-action',
        size === 'sm' && 'size-9 text-xs',
        size === 'md' && 'size-11 text-sm',
        size === 'lg' && 'size-12 text-base',
      )}
    >
      {text}
    </span>
  );
}
