import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Plus, Sparkles } from 'lucide-react';
import { CATEGORY_COLORS } from '../lib/colors';
import { formatINRWhole } from '../lib/format';
import { useStore } from '../store/store';

const IDEAS = ['PG / Rent', 'Food', 'UPI Misc', 'Travel', 'Savings'];

interface Props {
  budget: number;
  budgetSet: boolean;
  onSetBudget: () => void;
  onCreateCategory: () => void;
}

/** Shown only on a completely fresh start. Nothing is pre-created or pre-allocated. */
export function Onboarding({ budget, budgetSet, onSetBudget, onCreateCategory }: Props) {
  const { state, dispatch } = useStore();
  const [added, setAdded] = useState<Set<string>>(new Set());

  const toggle = (name: string) => {
    if (added.has(name)) return;
    const used = state.categories.length;
    dispatch({ type: 'ADD_CATEGORY', category: { name, color: CATEGORY_COLORS[used % CATEGORY_COLORS.length], limit: null } });
    setAdded(new Set(added).add(name));
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="neo relative overflow-hidden p-5 sm:p-7"
      aria-label="Get started"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" aria-hidden />
      <div className="relative">
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">
          <Sparkles size={14} /> Welcome
        </p>
        <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">
          {budgetSet ? `Your ${formatINRWhole(budget)} is ready. Spend it your way.` : 'Everything starts at ₹0. Set your budget to begin.'}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-mute">
          There are no preset percentages or buckets. Log expenses straight against your balance, or build your own categories — with a
          limit only if you want one.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs text-mute">Need ideas? Tap to add:</span>
          {IDEAS.map((name) => {
            const done = added.has(name) || state.categories.some((c) => c.name.toLowerCase() === name.toLowerCase());
            return (
              <button key={name} type="button" className="chip" aria-pressed={done} disabled={done} onClick={() => toggle(name)}>
                {done ? <Check size={14} className="text-emerald-300" /> : <Plus size={14} />}
                {name}
              </button>
            );
          })}
          <button type="button" className="chip text-emerald-300" onClick={onCreateCategory}>
            <Plus size={14} /> Make my own
          </button>
        </div>

        <div className="mt-5">
          {budgetSet ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const el = document.getElementById('amount-input');
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el?.focus({ preventScroll: true });
              }}
            >
              Log my first expense
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onSetBudget}>
              Set my monthly budget
            </button>
          )}
        </div>
      </div>
    </motion.section>
  );
}
