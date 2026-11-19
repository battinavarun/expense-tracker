import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Banknote, Plus, Smartphone, Check, X, RotateCcw } from 'lucide-react';
import { PAYMENT_METHODS, type Expense, type MonthKey, type PaymentMethod } from '../types';
import type { MonthSummary } from '../lib/calc';
import { daysInMonth, monthOf, todayKey } from '../lib/dates';
import { formatINR, parseAmount } from '../lib/format';
import { newId } from '../lib/storage';
import { useStore } from '../store/store';
import { useToast } from './Toast';

interface Props {
  month: MonthKey;
  summary: MonthSummary;
  editing: Expense | null;
  onDoneEditing: () => void;
  onNewCategory: () => void;
}

const METHOD_ICON: Record<PaymentMethod, JSX.Element> = {
  UPI: <Smartphone size={14} />,
  Card: <CreditCard size={14} />,
  Cash: <Banknote size={14} />,
};

function defaultDate(month: MonthKey) {
  const t = todayKey();
  return monthOf(t) === month ? t : `${month}-01`;
}

export function ExpenseLogger({ month, summary, editing, onDoneEditing, onNewCategory }: Props) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const amountRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('UPI');
  const [date, setDate] = useState(() => defaultDate(month));
  const [error, setError] = useState('');

  // Keep the date inside the month being viewed.
  useEffect(() => {
    if (!editing) setDate(defaultDate(month));
  }, [month, editing]);

  // Load an expense into the form for editing.
  useEffect(() => {
    if (!editing) return;
    setAmount(String(editing.amount));
    setNote(editing.note);
    setCategoryId(editing.categoryId);
    setMethod(editing.method);
    setDate(editing.date);
    setError('');
    amountRef.current?.focus();
    amountRef.current?.select();
  }, [editing]);

  // If the chosen category was deleted, fall back to Uncategorized.
  useEffect(() => {
    if (categoryId && !state.categories.some((c) => c.id === categoryId)) setCategoryId(null);
  }, [state.categories, categoryId]);

  // "n" jumps to the amount box from anywhere (unless you're already typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (e.key.toLowerCase() === 'n' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        amountRef.current?.focus();
        amountRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Your most-repeated recent spends, one tap to prefill.
  const repeats = useMemo(() => {
    const seen = new Set<string>();
    const out: Expense[] = [];
    const recent = [...state.expenses].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 120);
    for (const e of recent) {
      if (!e.note) continue;
      const k = `${e.note.toLowerCase()}|${e.amount}|${e.categoryId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(e);
      if (out.length >= 6) break;
    }
    return out;
  }, [state.expenses]);

  const prefill = (e: Expense) => {
    setAmount(String(e.amount));
    setNote(e.note);
    setCategoryId(e.categoryId && state.categories.some((c) => c.id === e.categoryId) ? e.categoryId : null);
    setMethod(e.method);
    setError('');
    amountRef.current?.focus();
  };

  const minDate = `${month}-01`;
  const maxDate = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
  const statById = useMemo(() => new Map(summary.stats.map((s) => [s.id, s])), [summary.stats]);

  const reset = () => {
    setAmount('');
    setNote('');
    setError('');
    setDate(defaultDate(month));
    amountRef.current?.focus();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseAmount(amount);
    if (value === null) {
      setError('Enter an amount above ₹0 (up to 2 decimals).');
      amountRef.current?.focus();
      return;
    }
    if (date < minDate || date > maxDate) {
      setError(`Pick a date within this month.`);
      return;
    }
    const cleanNote = note.trim().slice(0, 120);

    if (editing) {
      dispatch({ type: 'UPDATE_EXPENSE', expense: { ...editing, amount: value, note: cleanNote, categoryId, method, date } });
      toast('Expense updated');
      onDoneEditing();
      reset();
      return;
    }

    const id = newId();
    dispatch({ type: 'ADD_EXPENSE', expense: { id, amount: value, note: cleanNote, categoryId, method, date } });

    // Gentle heads-ups (never blocks logging).
    const stat = statById.get(categoryId);
    const warnings: string[] = [];
    if (stat?.limit && stat.spent <= stat.limit && stat.spent + value > stat.limit) warnings.push(`${stat.name} passed its ${formatINR(stat.limit)} limit`);
    if (summary.remaining >= 0 && summary.remaining - value < 0) warnings.push('you are over budget for the month');
    toast(`Logged ${formatINR(value)}${stat ? ` · ${stat.name}` : ''}${warnings.length ? ` — ${warnings.join(' & ')}` : ''}`, {
      tone: warnings.length ? 'warn' : 'ok',
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'DELETE_EXPENSE', id }),
    });
    reset();
  };

  return (
    <motion.form
      onSubmit={submit}
      layout
      className="neo p-4 sm:p-5"
      aria-label={editing ? 'Edit expense' : 'Log an expense'}
      noValidate
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-mute">
          {editing ? 'Edit expense' : 'Quick log'}
          {!editing && <kbd className="ml-2 hidden rounded-md bg-black/30 px-1.5 py-0.5 font-mono text-[10px] normal-case tracking-normal text-mute sm:inline">press N</kbd>}
        </h2>
        {editing && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              onDoneEditing();
              reset();
            }}
          >
            <X size={13} /> Cancel
          </button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,11rem)]">
        <div>
          <label className="label" htmlFor="amount-input">
            Amount
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-lg text-mute">₹</span>
            <input
              id="amount-input"
              ref={amountRef}
              className="field tabular !pl-9 font-mono text-xl font-bold"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={amount}
              aria-invalid={!!error}
              aria-describedby={error ? 'logger-error' : undefined}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="note-input">
            What I spent on
          </label>
          <input
            id="note-input"
            className="field"
            placeholder="e.g. Lunch, auto fare, electricity bill"
            maxLength={120}
            autoComplete="off"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="date-input">
            Date
          </label>
          <input
            id="date-input"
            type="date"
            className="field"
            min={minDate}
            max={maxDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {!editing && repeats.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Quick repeats">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">Repeat</span>
          {repeats.map((r) => (
            <button key={r.id} type="button" className="chip !px-2.5 !py-1 text-xs" onClick={() => prefill(r)} title={`Prefill ${r.note} · ${formatINR(r.amount)}`}>
              <RotateCcw size={11} className="text-mute" />
              {r.note.length > 16 ? `${r.note.slice(0, 15)}…` : r.note}
              <span className="font-mono text-mute">{formatINR(r.amount)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-end">
        <div>
          <span className="label" id="cat-label">
            Category
          </span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="cat-label">
            <button
              type="button"
              role="radio"
              aria-checked={categoryId === null}
              className="chip"
              style={{ ['--chip' as string]: '#64748b' }}
              onClick={() => setCategoryId(null)}
            >
              None
            </button>
            {state.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={categoryId === c.id}
                className="chip"
                style={{ ['--chip' as string]: c.color }}
                onClick={() => setCategoryId(c.id)}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}99` }} />
                {c.name}
              </button>
            ))}
            <button type="button" className="chip text-emerald-300" onClick={onNewCategory}>
              <Plus size={14} /> New
            </button>
          </div>
        </div>

        <div>
          <span className="label" id="method-label">
            Paid via
          </span>
          <div className="neo-inset flex gap-1 p-1" role="radiogroup" aria-labelledby="method-label">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={method === m}
                className="chip !rounded-xl !px-3 !py-2 text-xs"
                onClick={() => setMethod(m)}
              >
                {METHOD_ICON[m]}
                {m}
              </button>
            ))}
          </div>
        </div>

        <motion.button whileTap={{ scale: 0.97 }} type="submit" className="btn btn-primary h-[50px] w-full px-6 text-base lg:w-auto">
          {editing ? <Check size={18} /> : <Plus size={18} />}
          {editing ? 'Save changes' : 'Add expense'}
        </motion.button>
      </div>

      {error && (
        <p id="logger-error" role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      )}
    </motion.form>
  );
}
