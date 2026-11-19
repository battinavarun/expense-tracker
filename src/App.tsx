import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { Expense, MonthKey } from './types';
import { summarizeMonth } from './lib/calc';
import { currentMonthKey, todayKey } from './lib/dates';
import { NONE_KEY } from './lib/keys';
import { useStore } from './store/store';
import { TopBar } from './components/TopBar';
import { SalaryCard } from './components/SalaryCard';
import { StatsRow } from './components/StatsRow';
import { BudgetEditor } from './components/BudgetEditor';
import { ExpenseLogger } from './components/ExpenseLogger';
import { ExpenseList } from './components/ExpenseList';
import { CategoryDialog, CategoryPanel } from './components/CategoryPanel';
import { CategoryViz } from './components/CategoryViz';
import { InsightsPanel } from './components/InsightsPanel';
import { MoneyInDialog, ReconcileDialog } from './components/MoneyTools';
import { RecurringDrawer } from './components/RecurringDrawer';
import { Onboarding } from './components/Onboarding';

/** Fades/slides a section in as it enters, staggered by `i`. */
function Reveal({ i = 0, children, className }: { i?: number; children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      transition={{ type: 'spring', stiffness: 120, damping: 20, delay: Math.min(i * 0.06, 0.3) }}
    >
      {children}
    </motion.div>
  );
}

export default function App() {
  const { state } = useStore();
  const [month, setMonth] = useState<MonthKey>(currentMonthKey);
  const [budgetOpen, setBudgetOpen] = useState(false);
  // No budget yet (first run, or after "Erase all data") → ask for it. Skipping keeps everything at ₹0
  // for this visit; the prompt returns next time and whenever you try to log an expense.
  const [budgetSkipped, setBudgetSkipped] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [moneyInOpen, setMoneyInOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [catTarget, setCatTarget] = useState<'new' | string | undefined>(undefined);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);

  const [today, setToday] = useState(todayKey);
  const summary = useMemo(() => summarizeMonth(state, month, today), [state, month, today]);
  const interactive = state.viewMode === 'interactive';
  const fresh = state.categories.length === 0 && state.expenses.length === 0;
  const askBudget = budgetOpen || (!summary.budgetSet && !budgetSkipped);
  const closeBudget = () => {
    setBudgetOpen(false);
    setBudgetSkipped(true);
  };

  // Coins fly off the card whenever the number of expenses goes up (a log, an undo-of-delete, a recurring apply).
  const prevCount = useRef(state.expenses.length);
  useEffect(() => {
    if (state.expenses.length > prevCount.current) setBurst((b) => b + 1);
    prevCount.current = state.expenses.length;
  }, [state.expenses.length]);

  // Once a budget exists, forget any earlier "skip" so erasing all data asks again.
  useEffect(() => {
    if (summary.budgetSet) setBudgetSkipped(false);
  }, [summary.budgetSet]);

  // Month change: clear transient selection / edit state.
  const changeMonth = useCallback((m: MonthKey) => {
    setMonth(m);
    setSelectedKey(null);
    setEditing(null);
  }, []);

  // Keep "days left" honest if the tab stays open past midnight.
  useEffect(() => {
    const id = setInterval(() => setToday(todayKey()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Drop a selection if its category vanished.
  useEffect(() => {
    if (selectedKey && !summary.stats.some((s) => (s.id ?? NONE_KEY) === selectedKey)) setSelectedKey(null);
  }, [summary.stats, selectedKey]);

  // If the edited expense is deleted elsewhere, leave edit mode.
  useEffect(() => {
    if (editing && !state.expenses.some((e) => e.id === editing.id)) setEditing(null);
  }, [state.expenses, editing]);

  return (
    <div className="relative mx-auto w-full max-w-[1180px] px-4 pb-24 pt-5 sm:px-6 sm:pt-8">
      <div className="orbs" aria-hidden>
        <span className="orb orb-a" />
        <span className="orb orb-b" />
        <span className="orb orb-c" />
      </div>

      <TopBar month={month} onMonthChange={changeMonth} onOpenRecurring={() => setRecurringOpen(true)} />

      <main className="relative mt-6 space-y-5 sm:mt-8 sm:space-y-6">
        {/* Hero: tiltable salary card (+ floating coins) and live numbers */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,490px)_1fr] lg:gap-8">
          <SalaryCard summary={summary} interactive={interactive} burst={burst} onEditBudget={() => setBudgetOpen(true)} />
          <StatsRow
            summary={summary}
            onEditBudget={() => setBudgetOpen(true)}
            onMoneyIn={() => setMoneyInOpen(true)}
            onReconcile={() => setReconcileOpen(true)}
          />
        </div>

        {fresh && (
          <Onboarding
            budget={summary.baseBudget}
            budgetSet={summary.budgetSet}
            onSetBudget={() => setBudgetOpen(true)}
            onCreateCategory={() => setCatTarget('new')}
          />
        )}

        <Reveal>
          <ExpenseLogger
            month={month}
            summary={summary}
            editing={editing}
            onDoneEditing={() => setEditing(null)}
            onNewCategory={() => setCatTarget('new')}
            onNeedBudget={() => setBudgetOpen(true)}
          />
        </Reveal>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-6">
          <Reveal i={1}>
            <CategoryViz summary={summary} viewMode={state.viewMode} selectedKey={selectedKey} onSelect={setSelectedKey} />
          </Reveal>
          <Reveal i={2}>
            <CategoryPanel
              stats={summary.stats}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              onAdd={() => setCatTarget('new')}
              onEdit={(id) => setCatTarget(id)}
            />
          </Reveal>
        </div>

        <Reveal>
          <InsightsPanel summary={summary} />
        </Reveal>

        <Reveal>
          <ExpenseList
            summary={summary}
            editingId={editing?.id ?? null}
            onEdit={(e) => {
              setEditing(e);
              document.getElementById('amount-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          />
        </Reveal>
      </main>

      <footer className="relative mt-10 text-center text-xs text-mute">
        Your data lives only in this browser. Use the <span className="font-semibold text-ink/80">Backup</span> menu to export a copy.
      </footer>

      <BudgetEditor open={askBudget} month={month} onClose={closeBudget} />
      <RecurringDrawer open={recurringOpen} month={month} onClose={() => setRecurringOpen(false)} />
      <MoneyInDialog open={moneyInOpen} month={month} summary={summary} onClose={() => setMoneyInOpen(false)} />
      <ReconcileDialog open={reconcileOpen} month={month} summary={summary} onClose={() => setReconcileOpen(false)} />
      <CategoryDialog target={catTarget} onClose={() => setCatTarget(undefined)} />
    </div>
  );
}
