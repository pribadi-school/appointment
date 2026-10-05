/** Lightweight toasts, announced to screen readers via an aria-live region. */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { cx } from './ui';

type Toast = { id: number; text: string; tone: 'success' | 'error' | 'info' };
const ToastContext = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((x) => (
          <div
            key={x.id}
            role={x.tone === 'error' ? 'alert' : 'status'}
            className={cx(
              'pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-md bg-foreground px-4 py-3 text-sm font-medium text-on-primary shadow-e4 animate-step-in',
            )}
          >
            {x.tone === 'error' ? (
              <AlertCircle className="mt-px size-[18px] shrink-0 text-accent" aria-hidden />
            ) : (
              <CheckCircle2 className="mt-px size-[18px] shrink-0 text-gradient-end-on-dark" aria-hidden />
            )}
            <span>{x.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
