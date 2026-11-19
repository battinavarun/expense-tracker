import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface ToastItem {
  id: number;
  message: string;
  tone: 'ok' | 'warn' | 'error';
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastOptions {
  tone?: ToastItem['tone'];
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

const ToastContext = createContext<((message: string, opts?: ToastOptions) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (message: string, opts: ToastOptions = {}) => {
      const id = nextId.current++;
      setItems((l) => [...l.slice(-2), { id, message, tone: opts.tone ?? 'ok', actionLabel: opts.actionLabel, onAction: opts.onAction }]);
      setTimeout(() => dismiss(id), opts.durationMs ?? (opts.onAction ? 6000 : 3500));
    },
    [dismiss],
  );

  const value = useMemo(() => push, [push]);
  const dot = { ok: 'bg-emerald-400', warn: 'bg-amber-400', error: 'bg-red-400' } as const;

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        role="status"
      >
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ y: 24, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="neo-sm pointer-events-auto flex max-w-md items-center gap-3 px-4 py-3 text-sm"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${dot[t.tone]}`} />
              <span className="min-w-0 flex-1">{t.message}</span>
              {t.actionLabel && (
                <button
                  type="button"
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300 hover:bg-white/5"
                  onClick={() => {
                    t.onAction?.();
                    dismiss(t.id);
                  }}
                >
                  {t.actionLabel}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
