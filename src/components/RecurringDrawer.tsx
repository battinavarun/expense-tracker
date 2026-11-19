import { useMemo, useState } from 'react';
import { CheckCircle2, Plus, Repeat, Trash2, Zap } from 'lucide-react';
import { PAYMENT_METHODS, type MonthKey, type PaymentMethod } from '../types';
import { monthLabel } from '../lib/dates';
import { formatINR, parseAmount } from '../lib/format';
import { useStore } from '../store/store';
import { Modal } from './Modal';
import { useToast } from './Toast';

interface Props {
  open: boolean;
  month: MonthKey;
  onClose: () => void;
}

export function RecurringDrawer({ open, month, onClose }: Props) {
  const { state, dispatch } = useStore();
  const toast = useToast();

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [method, setMethod] = useState<PaymentMethod>('UPI');
  const [day, setDay] = useState('1');
  const [error, setError] = useState('');

  const appliedIds = useMemo(
    () => new Set(state.expenses.filter((e) => e.recurringId && e.date.startsWith(month)).map((e) => e.recurringId)),
    [state.expenses, month],
  );
  const pending = state.recurring.filter((r) => !appliedIds.has(r.id));
  const pendingTotal = pending.reduce((s, r) => s + r.amount, 0);
  const catName = (id: string | null) => state.categories.find((c) => c.id === id)?.name ?? 'Uncategorized';

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseAmount(amount);
    const d = Number(day);
    if (value === null) return setError('Enter an amount above ₹0.');
    if (!note.trim()) return setError('Name the bill, e.g. “PG rent”.');
    if (!Number.isInteger(d) || d < 1 || d > 31) return setError('Day of month must be 1–31.');
    dispatch({
      type: 'ADD_RECURRING',
      recurring: { amount: value, note: note.trim().slice(0, 120), categoryId: categoryId || null, method, dayOfMonth: d },
    });
    setAmount('');
    setNote('');
    setError('');
    toast('Saved to recurring bills');
  };

  const applyAll = () => {
    dispatch({ type: 'APPLY_RECURRING', month });
    toast(`Added ${pending.length} bill${pending.length === 1 ? '' : 's'} to ${monthLabel(month)}`);
  };

  return (
    <Modal open={open} onClose={onClose} title="Recurring bills" variant="right">
      <p className="mb-4 text-sm text-mute">
        Save fixed monthly bills once, then add them to any month with one click. Bills already added to a month are never duplicated.
      </p>

      <div className="neo-inset mb-5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">{monthLabel(month, 'long')}</p>
            <p className="mt-1 text-sm">
              {state.recurring.length === 0
                ? 'No bills saved yet'
                : pending.length === 0
                  ? 'All bills applied'
                  : `${pending.length} to apply · ${formatINR(pendingTotal)}`}
            </p>
          </div>
          <button type="button" className="btn btn-primary" disabled={pending.length === 0} onClick={applyAll}>
            <Zap size={16} /> Apply all
          </button>
        </div>
      </div>

      {state.recurring.length > 0 && (
        <ul className="mb-6 space-y-2">
          {state.recurring.map((r) => {
            const applied = appliedIds.has(r.id);
            return (
              <li key={r.id} className="neo-sm flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
                <div className="min-w-0 flex-1 basis-[7rem]">
                  <p className="truncate text-sm font-semibold">{r.note}</p>
                  <p className="truncate text-xs text-mute">
                    {catName(r.categoryId)} · {r.method} · day {r.dayOfMonth}
                  </p>
                </div>
                <span className="tabular whitespace-nowrap font-mono text-sm font-bold">{formatINR(r.amount)}</span>
                {applied ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-300" title="Already added this month">
                    <CheckCircle2 size={16} /> Added
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      dispatch({ type: 'APPLY_RECURRING', month, ids: [r.id] });
                      toast(`${r.note} added to ${monthLabel(month)}`);
                    }}
                  >
                    Add
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-lg p-2.5 text-mute hover:bg-white/5 hover:text-red-300 sm:p-2"
                  aria-label={`Delete ${r.note}`}
                  onClick={() => dispatch({ type: 'DELETE_RECURRING', id: r.id })}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={add} className="space-y-3" noValidate>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-mute">
          <Repeat size={13} /> New recurring bill
        </p>
        <div className="grid grid-cols-[1fr_1.4fr] gap-3">
          <div>
            <label className="label" htmlFor="rec-amount">
              Amount (₹)
            </label>
            <input id="rec-amount" className="field tabular font-mono" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="rec-note">
              Bill
            </label>
            <input id="rec-note" className="field" placeholder="PG rent, Wi-Fi…" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="label" htmlFor="rec-cat">
              Category
            </label>
            <select id="rec-cat" className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">None</option>
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="rec-method">
              Paid via
            </label>
            <select id="rec-method" className="field" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="rec-day">
              Day
            </label>
            <input id="rec-day" className="field tabular" inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} />
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
        <button type="submit" className="btn w-full">
          <Plus size={16} /> Save recurring bill
        </button>
      </form>
    </Modal>
  );
}
