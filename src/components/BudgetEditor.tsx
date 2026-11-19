import { useEffect, useState } from 'react';
import type { MonthKey } from '../types';
import { monthLabel } from '../lib/dates';
import { formatINRWhole, parseAmount } from '../lib/format';
import { useStore } from '../store/store';
import { useToast } from './Toast';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  month: MonthKey;
  onClose: () => void;
}

export function BudgetEditor({ open, month, onClose }: Props) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const hasOverride = month in state.budgetOverrides;
  const current = hasOverride ? state.budgetOverrides[month] : state.defaultBudget;
  const [text, setText] = useState(String(current));
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setText(String(current));
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = (scope: 'month' | 'all') => {
    const amount = parseAmount(text);
    if (amount === null) {
      setError('Enter a budget greater than ₹0.');
      return;
    }
    dispatch({ type: 'SET_BUDGET', amount, scope, month });
    toast(scope === 'all' ? `Budget set to ${formatINRWhole(amount)} for every month` : `Budget for ${monthLabel(month)} set to ${formatINRWhole(amount)}`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit monthly budget">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save('month');
        }}
        className="space-y-4"
      >
        <div>
          <label className="label" htmlFor="budget-input">
            Budget (₹)
          </label>
          <input
            id="budget-input"
            className="field tabular font-mono text-lg"
            inputMode="decimal"
            value={text}
            aria-invalid={!!error}
            onChange={(e) => {
              setText(e.target.value);
              setError('');
            }}
          />
          {error && <p className="mt-1.5 text-xs text-red-300">{error}</p>}
        </div>
        <p className="text-xs text-mute">
          Default is <strong className="text-ink">{formatINRWhole(state.defaultBudget)}</strong>.
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
        {hasOverride && (
          <button
            type="button"
            className="btn btn-sm w-full"
            onClick={() => {
              dispatch({ type: 'CLEAR_MONTH_BUDGET', month });
              toast(`${monthLabel(month)} now follows the default budget`);
              onClose();
            }}
          >
            Reset {monthLabel(month)} to default ({formatINRWhole(state.defaultBudget)})
          </button>
        )}
      </form>
    </Modal>
  );
}
