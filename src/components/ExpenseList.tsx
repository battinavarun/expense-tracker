import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pencil, Repeat, Search, Trash2, Receipt } from 'lucide-react';
import type { Expense } from '../types';
import type { MonthSummary } from '../lib/calc';
import { UNCATEGORIZED_COLOR } from '../lib/calc';
import { formatDayLong } from '../lib/dates';
import { formatINR, round2 } from '../lib/format';
import { useStore } from '../store/store';
import { useToast } from './Toast';

interface Props {
  summary: MonthSummary;
  editingId: string | null;
  onEdit: (e: Expense) => void;
}

const PAGE = 60;

export function ExpenseList({ summary, editingId, onEdit }: Props) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>('all'); // 'all' | '__none__' | category id
  const [limit, setLimit] = useState(PAGE);

  const catById = useMemo(() => new Map(state.categories.map((c) => [c.id, c])), [state.categories]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return summary.expenses.filter((e) => {
      const cat = e.categoryId ? catById.get(e.categoryId) : undefined;
      if (filter !== 'all' && (filter === '__none__' ? !!cat : e.categoryId !== filter)) return false;
      if (!q) return true;
      return (
        e.note.toLowerCase().includes(q) ||
        (cat?.name.toLowerCase().includes(q) ?? false) ||
        e.method.toLowerCase().includes(q) ||
        String(e.amount).includes(q)
      );
    });
  }, [summary.expenses, query, filter, catById]);

  const visible = rows.slice(0, limit);
  const groups = useMemo(() => {
    const out: { date: string; items: Expense[]; total: number }[] = [];
    for (const e of visible) {
      const last = out[out.length - 1];
      if (last && last.date === e.date) {
        last.items.push(e);
        last.total = round2(last.total + e.amount);
      } else out.push({ date: e.date, items: [e], total: e.amount });
    }
    return out;
  }, [visible]);

  const remove = (e: Expense) => {
    dispatch({ type: 'DELETE_EXPENSE', id: e.id });
    toast(`Deleted ${formatINR(e.amount)}${e.note ? ` · ${e.note}` : ''}`, {
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'ADD_EXPENSE', expense: e }),
    });
  };

  const makeRecurring = (e: Expense) => {
    dispatch({
      type: 'ADD_RECURRING',
      recurring: {
        amount: e.amount,
        note: e.note,
        categoryId: e.categoryId,
        method: e.method,
        dayOfMonth: Number(e.date.slice(8, 10)),
      },
    });
    toast('Saved as a monthly bill in Recurring');
  };

  return (
    <section className="neo p-4 sm:p-5" aria-label="Expenses this month">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-mute">
          Expenses <span className="ml-1 text-ink/60">({summary.expenses.length})</span>
        </h2>
        {summary.expenses.length > 0 && (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-52 sm:flex-none">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
              <input
                className="field !py-2 !pl-9 text-xs"
                placeholder="Search…"
                aria-label="Search expenses"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(PAGE);
                }}
              />
            </div>
            <select
              className="field !w-auto !py-2 text-xs"
              aria-label="Filter by category"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setLimit(PAGE);
              }}
            >
              <option value="all">All categories</option>
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="__none__">Uncategorized</option>
            </select>
          </div>
        )}
      </div>

      {summary.expenses.length === 0 ? (
        <div className="neo-inset flex flex-col items-center gap-2 px-6 py-10 text-center">
          <Receipt size={28} className="text-mute" />
          <p className="text-sm font-semibold">Nothing logged this month yet</p>
          <p className="max-w-xs text-xs text-mute">Type an amount above and press Enter. Your whole balance is still untouched.</p>
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-mute">No expenses match that search.</p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.date}>
              <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold text-mute">
                <span>{formatDayLong(g.date)}</span>
                <span className="tabular font-mono">{formatINR(g.total)}</span>
              </div>
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {g.items.map((e) => {
                    const cat = e.categoryId ? catById.get(e.categoryId) : undefined;
                    const color = cat?.color ?? UNCATEGORIZED_COLOR;
                    return (
                      <motion.li
                        key={e.id}
                        layout
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -24 }}
                        transition={{ duration: 0.2 }}
                        className={`neo-sm flex items-center gap-3 px-3 py-2.5 sm:px-4 ${editingId === e.id ? 'ring-2 ring-emerald-400/60' : ''}`}
                      >
                        <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}66` }} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{e.note || cat?.name || 'Expense'}</p>
                          <p className="truncate text-xs text-mute">
                            {cat?.name ?? 'Uncategorized'} · {e.method}
                            {e.recurringId && ' · recurring'}
                          </p>
                        </div>
                        <p className="tabular shrink-0 font-mono text-sm font-bold">{formatINR(e.amount)}</p>
                        <div className="flex shrink-0 gap-1">
                          <IconBtn label="Save as monthly recurring bill" onClick={() => makeRecurring(e)}>
                            <Repeat size={14} />
                          </IconBtn>
                          <IconBtn label="Edit expense" onClick={() => onEdit(e)}>
                            <Pencil size={14} />
                          </IconBtn>
                          <IconBtn label="Delete expense" onClick={() => remove(e)} danger>
                            <Trash2 size={14} />
                          </IconBtn>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </div>
          ))}
          {rows.length > limit && (
            <button type="button" className="btn btn-sm mx-auto flex" onClick={() => setLimit((l) => l + PAGE)}>
              Show more ({rows.length - limit} left)
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-lg p-2 text-mute transition hover:bg-white/5 active:scale-90 ${danger ? 'hover:text-red-300' : 'hover:text-ink'}`}
    >
      {children}
    </button>
  );
}
