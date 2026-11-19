import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** 'center' dialog, or a 'right' side drawer. */
  variant?: 'center' | 'right';
}

export function Modal({ open, onClose, title, children, variant = 'center' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus the first field (or the panel) so keyboard users land inside.
    const t = setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])');
      (first ?? panelRef.current)?.focus();
    }, 60);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prev?.focus?.();
    };
  }, [open]);

  const isDrawer = variant === 'right';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`fixed inset-0 z-50 flex ${isDrawer ? 'justify-end' : 'items-end justify-center sm:items-center'} p-0 sm:p-4`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className={`neo relative z-10 flex w-full flex-col overflow-hidden outline-none ${
              isDrawer
                ? 'h-full max-h-full max-w-md rounded-none sm:h-auto sm:max-h-[92dvh] sm:self-center sm:rounded-[22px]'
                : 'max-h-[92dvh] max-w-lg rounded-b-none sm:rounded-b-[22px]'
            }`}
            initial={isDrawer ? { x: 60, opacity: 0 } : { y: 40, opacity: 0, scale: 0.98 }}
            animate={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            exit={isDrawer ? { x: 60, opacity: 0 } : { y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
              <h2 className="min-w-0 text-lg font-bold leading-snug tracking-tight">{title}</h2>
              <button type="button" data-close className="btn btn-icon shrink-0" onClick={onClose} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
