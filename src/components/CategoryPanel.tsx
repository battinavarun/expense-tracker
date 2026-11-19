import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, Layers } from 'lucide-react';
import type { CategoryStat } from '../lib/calc';
import { CATEGORY_COLORS, CORAL } from '../lib/colors';
import { formatINR, formatINRWhole, formatPercent, parseAmount } from '../lib/format';
import { statKey } from '../lib/keys';
import { newId } from '../lib/storage';
import { useStore } from '../store/store';
import { Modal } from './Modal';
import { useToast } from './Toast';

interface PanelProps {
  stats: CategoryStat[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
}

export function CategoryPanel({ stats, selectedKey, onSelect, onAdd, onEdit }: PanelProps) {
  const { dispatch } = useStore();
  const toast = useToast();

  const remove = (s: CategoryStat) => {
    if (!s.id) return;
    const msg = s.count
      ? `Delete “${s.name}”? Its expenses stay in your history as Uncategorized.`
      : `Delete “${s.name}”?`;
    if (window.confirm(msg)) {
      dispatch({ type: 'DELETE_CATEGORY', id: s.id });
      toast(`Deleted ${s.name}`);
    }
  };

  return (
    <section className="neo p-4 sm:p-5" aria-label="Categories">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-mute">Categories</h2>
        <button type="button" className="btn btn-sm" onClick={onAdd}>
          <Plus size={14} /> New
        </button>
      </div>

      {stats.length === 0 ? (
        <div className="neo-inset flex flex-col items-center gap-2 px-5 py-8 text-center">
          <Layers size={24} className="text-mute" />
          <p className="text-sm font-semibold">No categories yet</p>
          <p className="text-xs text-mute">Create your own envelopes — limits are optional.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {stats.map((s) => {
            const key = statKey(s);
            const selected = selectedKey === key;
            const over = s.limitRatio !== null && s.limitRatio > 1;
            const barRatio = s.limitRatio !== null ? Math.min(1, s.limitRatio) : Math.min(1, s.shareOfBudget);
            return (
              <li
                key={key}
                className={`neo-sm flex items-center gap-2 p-2.5 transition ${selected ? 'ring-2' : ''}`}
                style={selected ? ({ ['--tw-ring-color' as string]: s.color } as React.CSSProperties) : undefined}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-xl p-1.5 text-left"
                  aria-pressed={selected}
                  onClick={() => onSelect(selected ? null : key)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                    <span className="flex min-w-0 flex-1 basis-[6.5rem] items-center gap-2 text-sm font-semibold">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}88` }} />
                      <span className="truncate" title={s.name}>
                        {s.name}
                      </span>
                    </span>
                    <span className="tabular shrink-0 whitespace-nowrap font-mono text-xs" style={{ color: over ? CORAL : undefined }}>
                      {formatINR(s.spent)}
                      {s.limit ? <span className="text-mute"> / {formatINRWhole(s.limit)}</span> : null}
                    </span>
                  </div>
                  <div className="neo-inset mt-2 h-2 overflow-hidden !rounded-full">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${barRatio * 100}%`, background: over ? CORAL : s.color }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-mute">
                    {s.limit
                      ? over
                        ? `${formatINR(s.spent - s.limit)} over limit`
                        : `${formatINR(s.limit - s.spent)} left of limit`
                      : `${formatPercent(s.shareOfBudget)} of budget`}
                    {' · '}
                    {s.count} entr{s.count === 1 ? 'y' : 'ies'}
                  </p>
                </button>
                {s.id && (
                  <div className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      className="rounded-lg p-2.5 text-mute hover:bg-white/5 hover:text-ink sm:p-1.5"
                      aria-label={`Edit ${s.name}`}
                      onClick={() => onEdit(s.id as string)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-2.5 text-mute hover:bg-white/5 hover:text-red-300 sm:p-1.5"
                      aria-label={`Delete ${s.name}`}
                      onClick={() => remove(s)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

interface DialogProps {
  /** undefined = closed, 'new' = create, otherwise the id being edited */
  target: 'new' | string | undefined;
  onClose: () => void;
  /** Called with the new category id after creating one. */
  onCreated?: (id: string) => void;
}

export function CategoryDialog({ target, onClose, onCreated }: DialogProps) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const open = target !== undefined;
  const existing = target && target !== 'new' ? state.categories.find((c) => c.id === target) : undefined;

  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [limit, setLimit] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (existing) {
      setName(existing.name);
      setColor(existing.color);
      setLimit(existing.limit ? String(existing.limit) : '');
    } else {
      setName('');
      // Pick the first palette colour not already used, so new categories look distinct.
      const used = new Set(state.categories.map((c) => c.color));
      setColor(CATEGORY_COLORS.find((c) => !used.has(c)) ?? CATEGORY_COLORS[state.categories.length % CATEGORY_COLORS.length]);
      setLimit('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim().slice(0, 40);
    if (!clean) return setError('Give your category a name.');
    if (state.categories.some((c) => c.id !== existing?.id && c.name.toLowerCase() === clean.toLowerCase())) {
      return setError('You already have a category with that name.');
    }
    let lim: number | null = null;
    if (limit.trim() !== '') {
      lim = parseAmount(limit);
      if (lim === null) return setError('Limit must be an amount above ₹0 — or leave it blank.');
    }
    if (existing) {
      dispatch({ type: 'UPDATE_CATEGORY', category: { ...existing, name: clean, color, limit: lim } });
      toast(`Saved ${clean}`);
    } else {
      const id = newId();
      dispatch({ type: 'ADD_CATEGORY', category: { id, name: clean, color, limit: lim } });
      onCreated?.(id);
      toast(`Created ${clean}`);
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit category' : 'New category'}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div>
          <label className="label" htmlFor="cat-name">
            Name
          </label>
          <input
            id="cat-name"
            className="field"
            placeholder="e.g. PG / Rent, Food, UPI Misc, Travel, Savings"
            maxLength={40}
            value={name}
            aria-invalid={!!error}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
          />
        </div>

        <div>
          <span className="label">Colour</span>
          <div className="flex flex-wrap items-center gap-2.5">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className="h-8 w-8 rounded-full transition active:scale-90"
                style={{
                  background: c,
                  boxShadow:
                    color === c
                      ? `0 0 0 3px #1e232a, 0 0 0 5px ${c}, 0 0 14px ${c}`
                      : 'inset 0 1px 0 rgba(255,255,255,.4), 2px 2px 5px rgba(0,0,0,.5)',
                }}
              />
            ))}
            <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border border-white/10" title="Custom colour">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute -inset-2 h-12 w-12 cursor-pointer opacity-0"
                aria-label="Pick a custom colour"
              />
              <span
                className="block h-full w-full"
                style={{ background: 'conic-gradient(#f87171,#facc15,#34d399,#38bdf8,#a78bfa,#f472b6,#f87171)' }}
              />
            </label>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="cat-limit">
            Spending limit (₹) — optional
          </label>
          <input
            id="cat-limit"
            className="field tabular font-mono"
            inputMode="decimal"
            placeholder="Leave blank to just track spend"
            value={limit}
            onChange={(e) => {
              setLimit(e.target.value);
              setError('');
            }}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button type="button" className="btn flex-1" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary flex-1">
            {existing ? 'Save' : 'Create category'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
