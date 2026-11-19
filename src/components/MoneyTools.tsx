import { useEffect, useState } from 'react';
import { CheckCircle2, HandCoins, Plus, Scale, Trash2 } from 'lucide-react';
import type { MonthKey } from '../types';
import type { MonthSummary } from '../lib/calc';
import { CORAL, EMERALD } from '../lib/colors';
import { formatDay, monthLabel, monthOf, todayKey, daysInMonth } from '../lib/dates';
import { formatINR, formatINRWhole, parseAmount } from '../lib/format';
import { newId } from '../lib/storage';
import { useStore } from '../store/store';
import { Modal } from './Modal';
import { useToast } from './Toast';

function defaultDate(month: MonthKey) {
  const t = todayKey();
  return monthOf(t) === month ? t : `${month}-01`;
}

/* ------------------------------------------------------------- Money in */

export function MoneyInDialog({ open, month, summary, onClose }: { open: boolean; month: MonthKey; summary: MonthSummary; onClose: () => void }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => defaultDate(month));
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setDate(defaultDate(month));
      setError('');
    }
  }, [open, month]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseAmount(amount);
    if (value === null) return setError('Enter an amount above ₹0.');
    if (monthOf(date) !== month) return setError('Pick a date inside this month.');
    const id = newId();
    dispatch({ type: 'ADD_INCOME', income: { id, amount: value, note: note.trim().slice(0, 120) || 'Money in', date } });
    toast(`${formatINR(value)} added to ${monthLabel(month)}`, {
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'DELETE_INCOME', id }),
    });
    setAmount('');
    setNote('');
    setError('');
  };

  return (
    <Modal open={open} onClose={onClose} title="Money in">
      <p className="mb-4 text-sm text-mute">
        Side income, a refund, a friend paying you back — anything that adds to what you can spend in{' '}
        <strong className="text-ink">{monthLabel(month, 'long')}</strong>. It raises your balance and daily safe-to-spend.
      </p>

      <form onSubmit={submit} className="space-y-3" noValidate>
        <div className="grid grid-cols-[1fr_1.4fr] gap-3">
          <div>
            <label className="label" htmlFor="in-amount">
              Amount (₹)
            </label>
            <input
              id="in-amount"
              className="field tabular font-mono"
              inputMode="decimal"
              value={amount}
              aria-invalid={!!error}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
            />
          </div>
          <div>
            <label className="label" htmlFor="in-note">
              From
            </label>
            <input id="in-note" className="field" placeholder="Freelance, refund, repayment…" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="in-date">
            Date
          </label>
          <input
            id="in-date"
            type="date"
            className="field"
            min={`${month}-01`}
            max={`${month}-${String(daysInMonth(month)).padStart(2, '0')}`}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary w-full">
          <Plus size={16} /> Add money in
        </button>
      </form>

      <div className="mt-6">
        <p className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-[0.14em] text-mute">
          <span className="flex items-center gap-2">
            <HandCoins size={13} /> This month
          </span>
          <span className="tabular font-mono text-emerald-300">{formatINR(summary.income)}</span>
        </p>
        {summary.incomeEntries.length === 0 ? (
          <p className="neo-inset px-4 py-5 text-center text-xs text-mute">Nothing added yet.</p>
        ) : (
          <ul className="space-y-2">
            {summary.incomeEntries.map((i) => (
              <li key={i.id} className="neo-sm flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{i.note}</p>
                  <p className="text-xs text-mute">{formatDay(i.date)}</p>
                </div>
                <span className="tabular font-mono text-sm font-bold text-emerald-300">+{formatINR(i.amount)}</span>
                <button
                  type="button"
                  className="rounded-lg p-2.5 text-mute hover:bg-white/5 hover:text-red-300 sm:p-2"
                  aria-label={`Delete ${i.note}`}
                  onClick={() => {
                    dispatch({ type: 'DELETE_INCOME', id: i.id });
                    toast(`Removed ${formatINR(i.amount)}`, { actionLabel: 'Undo', onAction: () => dispatch({ type: 'ADD_INCOME', income: i }) });
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ Reconcile */

/**
 * "Where did my money go?" — type what your bank/UPI/wallet really shows. The app compares it to what it
 * thinks you have left and lets you log the gap, so the books always match reality.
 */
export function ReconcileDialog({ open, month, summary, onClose }: { open: boolean; month: MonthKey; summary: MonthSummary; onClose: () => void }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setText('');
      setError('');
    }
  }, [open]);

  const trimmed = text.trim();
  const actual = trimmed === '' ? null : trimmed === '0' ? 0 : parseAmount(trimmed);
  const invalid = trimmed !== '' && actual === null;
  const expected = summary.remaining;
  const diff = actual === null ? null : Math.round((actual - expected) * 100) / 100; // + = more than expected
  const date = defaultDate(month);

  const logMissing = () => {
    if (diff === null || diff >= 0) return;
    const value = -diff;
    const id = newId();
    dispatch({ type: 'ADD_EXPENSE', expense: { id, amount: value, note: 'Untracked spending (reconciled)', categoryId: null, method: 'Cash', date } });
    toast(`Logged ${formatINR(value)} as untracked spending`, { actionLabel: 'Undo', onAction: () => dispatch({ type: 'DELETE_EXPENSE', id }) });
    onClose();
  };
  const logExtra = () => {
    if (diff === null || diff <= 0) return;
    const id = newId();
    dispatch({ type: 'ADD_INCOME', income: { id, amount: diff, note: 'Unexplained extra (reconciled)', date } });
    toast(`Added ${formatINR(diff)} as money in`, { actionLabel: 'Undo', onAction: () => dispatch({ type: 'DELETE_INCOME', id }) });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Reconcile — find missing rupees">
      <p className="mb-4 text-sm text-mute">
        Open your bank / UPI app and enter the money you actually have left. We’ll compare it with what Rupee Vault expects.
      </p>
      <div className="neo-inset mb-4 flex items-center justify-between p-4">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">Rupee Vault expects</span>
        <span className="tabular font-mono text-lg font-bold">{formatINR(expected)}</span>
      </div>

      <label className="label" htmlFor="rec-actual">
        What you actually have (₹)
      </label>
      <input
        id="rec-actual"
        className="field tabular font-mono text-lg"
        inputMode="decimal"
        placeholder="e.g. 31,450"
        value={text}
        aria-invalid={invalid || !!error}
        onChange={(e) => {
          setText(e.target.value);
          setError('');
        }}
      />
      {invalid && <p className="mt-1.5 text-xs text-red-300">Enter a valid amount.</p>}

      {diff !== null && (
        <div className="mt-5 rounded-2xl p-4" style={{ background: diff === 0 ? `${EMERALD}14` : diff < 0 ? `${CORAL}14` : '#38bdf814', boxShadow: `inset 0 0 0 1px ${diff === 0 ? EMERALD : diff < 0 ? CORAL : '#38bdf8'}44` }} aria-live="polite">
          {diff === 0 ? (
            <p className="flex items-center gap-2 font-semibold text-emerald-300">
              <CheckCircle2 size={18} /> Perfect — every rupee is accounted for.
            </p>
          ) : diff < 0 ? (
            <>
              <p className="font-semibold" style={{ color: CORAL }}>
                {formatINRWhole(-diff)} is missing
              </p>
              <p className="mt-1 text-xs text-mute">You have less than your log says. Something wasn’t recorded — log it so your numbers match reality.</p>
              <button type="button" className="btn btn-primary mt-3 w-full" onClick={logMissing}>
                <Scale size={16} /> Log {formatINR(-diff)} as untracked spending
              </button>
            </>
          ) : (
            <>
              <p className="font-semibold text-sky-300">{formatINRWhole(diff)} more than expected</p>
              <p className="mt-1 text-xs text-mute">Maybe a refund or payment you didn’t record, or an expense logged twice.</p>
              <button type="button" className="btn mt-3 w-full" onClick={logExtra}>
                <HandCoins size={16} /> Add {formatINR(diff)} as money in
              </button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
