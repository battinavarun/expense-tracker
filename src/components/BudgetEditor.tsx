import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Upload } from 'lucide-react';
import type { MonthKey } from '../types';
import { daysInMonth, monthLabel, todayKey } from '../lib/dates';
import { formatINRWhole, parseAmount } from '../lib/format';
import { useStore } from '../store/store';
import { useToast } from './Toast';
import { Modal } from './Modal';
import { useBackupImport } from './useBackupImport';

interface Props {
  open: boolean;
  month: MonthKey;
  /** Closing without saving (X, Esc, backdrop, or "Skip"). */
  onClose: () => void;
}

/**
 * Asks for the monthly budget. Used both for the very first launch (no budget yet — everything reads ₹0
 * until the user types their own amount) and for editing it later.
 */
export function BudgetEditor({ open, month, onClose }: Props) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const importBackup = useBackupImport();
  const fileRef = useRef<HTMLInputElement>(null);

  const firstRunNow = state.defaultBudget === null && !(month in state.budgetOverrides);
  // Freeze the mode while the dialog is open so saving doesn't flip its layout mid-close-animation.
  const [firstRun, setFirstRun] = useState(firstRunNow);
  useEffect(() => {
    if (open) setFirstRun(firstRunNow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const hasOverride = month in state.budgetOverrides;
  const current = hasOverride ? state.budgetOverrides[month] : state.defaultBudget;
  const defaultLabel = state.defaultBudget === null ? 'not set' : formatINRWhole(state.defaultBudget);

  const [text, setText] = useState(current === null ? '' : String(current));
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setText(current === null ? '' : String(current));
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const amount = parseAmount(text);

  const save = (scope: 'month' | 'all') => {
    if (amount === null) {
      setError('Enter an amount greater than ₹0.');
      return;
    }
    dispatch({ type: 'SET_BUDGET', amount, scope, month });
    toast(
      firstRun
        ? `Budget set to ${formatINRWhole(amount)} — you're ready to track`
        : scope === 'all'
          ? `Budget set to ${formatINRWhole(amount)} for every month`
          : `Budget for ${monthLabel(month)} set to ${formatINRWhole(amount)}`,
    );
    onClose();
  };

  const daysLeft = daysInMonth(month) - (month === todayKey().slice(0, 7) ? Number(todayKey().slice(8, 10)) - 1 : 0);

  return (
    <Modal open={open} onClose={onClose} title={firstRun ? 'Set your monthly budget' : 'Edit monthly budget'}>
      {firstRun && (
        <p className="mb-4 text-sm text-mute">
          Everything starts at <strong className="text-ink">₹0</strong>. Enter how much you have to spend each month — it’s entirely your number, there are
          no preset buckets or percentages, and you can change it anytime.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(firstRun ? 'all' : 'month');
        }}
        className="space-y-4"
        noValidate
      >
        <div>
          <label className="label" htmlFor="budget-input">
            {firstRun ? 'Monthly budget' : 'Budget (₹)'}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-xl text-mute">₹</span>
            <input
              id="budget-input"
              className="field tabular !pl-10 font-mono text-xl font-bold"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={text}
              aria-invalid={!!error}
              aria-describedby={error ? 'budget-error' : 'budget-hint'}
              onChange={(e) => {
                setText(e.target.value);
                setError('');
              }}
            />
          </div>
          {error ? (
            <p id="budget-error" role="alert" className="mt-1.5 text-xs text-red-300">
              {error}
            </p>
          ) : (
            <p id="budget-hint" className="mt-1.5 min-h-[1.1rem] text-xs text-mute" aria-live="polite">
              {amount !== null && (
                <>
                  <strong className="text-ink">{formatINRWhole(amount)}</strong> for {monthLabel(month, 'long')} — about{' '}
                  <strong className="text-ink">{formatINRWhole(amount / Math.max(1, daysLeft))}</strong> a day.
                </>
              )}
            </p>
          )}
        </div>

        {firstRun ? (
          <>
            <button type="submit" className="btn btn-primary h-[50px] w-full text-base">
              Start tracking <ArrowRight size={18} />
            </button>
            <button type="button" className="btn btn-sm w-full" onClick={onClose}>
              Skip for now — keep everything at ₹0
            </button>
            <div className="border-t border-white/5 pt-3 text-center">
              <button type="button" className="inline-flex items-center gap-2 text-xs text-mute hover:text-ink" onClick={() => fileRef.current?.click()}>
                <Upload size={13} /> Already use Rupee Vault? Restore a JSON backup
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={async (e) => {
                  const ok = await importBackup(e.target.files?.[0]);
                  e.target.value = '';
                  if (ok) onClose();
                }}
              />
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-mute">
              Default is <strong className="text-ink">{defaultLabel}</strong>.
              {hasOverride && <> {monthLabel(month)} currently uses its own budget of {formatINRWhole(state.budgetOverrides[month])}.</>}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button type="submit" className="btn btn-primary">
                {monthLabel(month)} only
              </button>
              <button type="button" className="btn" onClick={() => save('all')}>
                All months
              </button>
            </div>
            {hasOverride && state.defaultBudget !== null && (
              <button
                type="button"
                className="btn btn-sm w-full"
                onClick={() => {
                  dispatch({ type: 'CLEAR_MONTH_BUDGET', month });
                  toast(`${monthLabel(month)} now follows the default budget`);
                  onClose();
                }}
              >
                Reset {monthLabel(month)} to default ({defaultLabel})
              </button>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
