import { motion } from 'framer-motion';
import { CalendarClock, Landmark, PiggyBank, Scale, Sun, TrendingDown, TrendingUp, Wallet, HandCoins } from 'lucide-react';
import type { MonthSummary } from '../lib/calc';
import { CORAL, EMERALD } from '../lib/colors';
import { formatINR, formatINRWhole, formatPercent } from '../lib/format';
import { useStore } from '../store/store';
import { AnimatedNumber } from './AnimatedNumber';

interface Props {
  summary: MonthSummary;
  onEditBudget: () => void;
  onMoneyIn: () => void;
  onReconcile: () => void;
}

export function StatsRow({ summary, onEditBudget, onMoneyIn, onReconcile }: Props) {
  const { state, dispatch } = useStore();
  const accent = summary.accent;
  const ins = summary.insights;

  const extras = [
    summary.income > 0 ? `${formatINRWhole(summary.income)} money in` : '',
    summary.carried > 0 ? `${formatINRWhole(summary.carried)} carried` : '',
  ].filter(Boolean);

  const dailyText = !summary.budgetSet
    ? 'Set your budget first'
    : summary.dailySafe === null
      ? 'Month complete'
      : summary.remaining <= 0
        ? 'Nothing left to spend'
        : `${formatINRWhole(summary.remaining)} ÷ ${summary.daysLeft} day${summary.daysLeft === 1 ? '' : 's'} left`;

  const showToday = summary.days.some((d) => d.isToday);
  // "Today" compares against what you could have spent today: safe-to-spend now + what's already gone today.
  const todayBudget = summary.daysLeft > 0 ? Math.max(0, summary.remaining + ins.todaySpent) / summary.daysLeft : null;
  const todayPct = todayBudget && todayBudget > 0 ? ins.todaySpent / todayBudget : 0;

  const projLeft = ins.projectedLeft;
  const projColor = projLeft === null ? undefined : projLeft < 0 ? CORAL : EMERALD;

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="grid flex-1 grid-cols-2 gap-3 sm:gap-4">
        <Tile
          icon={<Landmark size={15} />}
          label="Starting budget"
          sub={!summary.budgetSet ? 'Tap to set your budget' : extras.length ? `incl. ${extras.join(' + ')}` : 'Tap to edit'}
          onClick={onEditBudget}
          glow="#38bdf8"
        >
          <AnimatedNumber value={summary.available} format={formatINRWhole} />
        </Tile>
        <Tile
          icon={<TrendingDown size={15} />}
          label="Total spent"
          sub={`${formatPercent(summary.available > 0 ? summary.spent / summary.available : 0)} of budget · ${summary.expenses.length} entr${summary.expenses.length === 1 ? 'y' : 'ies'}`}
          glow="#f472b6"
        >
          <AnimatedNumber value={summary.spent} format={formatINR} />
        </Tile>
        <Tile
          icon={<Wallet size={15} />}
          label="Remaining"
          sub={!summary.budgetSet ? 'Set your budget first' : summary.over ? 'You have gone over budget' : `${formatPercent(Math.max(0, summary.ratio))} left`}
          valueColor={accent}
          glow={accent}
        >
          {summary.over && '−'}
          <AnimatedNumber value={Math.abs(summary.remaining)} format={formatINR} />
        </Tile>
        <Tile
          icon={<CalendarClock size={15} />}
          label="Daily safe-to-spend"
          sub={dailyText}
          valueColor={summary.dailySafe === null ? undefined : accent}
          glow={accent}
        >
          {summary.dailySafe === null ? '—' : <AnimatedNumber value={Math.floor(summary.dailySafe)} format={formatINRWhole} />}
        </Tile>
        <Tile
          icon={<Sun size={15} />}
          label="Spent today"
          sub={
            showToday && todayBudget !== null && todayBudget > 0
              ? `${formatPercent(todayPct)} of today's ${formatINRWhole(todayBudget)} allowance`
              : showToday
                ? 'No allowance left today'
                : 'Only for the current month'
          }
          valueColor={showToday && todayPct > 1 ? CORAL : undefined}
          glow="#facc15"
        >
          {showToday ? <AnimatedNumber value={ins.todaySpent} format={formatINR} /> : '—'}
        </Tile>
        <Tile
          icon={<TrendingUp size={15} />}
          label="Month-end forecast"
          sub={
            !summary.budgetSet
              ? 'Set your budget first'
              : ins.projected === null
                ? 'Starts when the month does'
                : projLeft !== null && projLeft < 0
                ? `At this pace you'll overshoot by ${formatINRWhole(-projLeft)}`
                : `At this pace you'll finish ${formatINRWhole(projLeft ?? 0)} ahead`
          }
          valueColor={summary.budgetSet ? projColor : undefined}
          glow={(summary.budgetSet && projColor) || '#a78bfa'}
        >
          {ins.projected === null ? '—' : <AnimatedNumber value={ins.projected} format={formatINRWhole} />}
        </Tile>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <button type="button" className="btn" onClick={onMoneyIn}>
          <HandCoins size={16} className="text-emerald-300" /> Money in
        </button>
        <button type="button" className="btn" onClick={onReconcile}>
          <Scale size={16} className="text-sky-300" /> Reconcile
        </button>
      </div>

      <label className="neo-sm flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm">
        <span className="flex items-center gap-2.5">
          <PiggyBank size={16} className="text-emerald-300" />
          <span>
            <span className="font-semibold">Carry forward leftover savings</span>
            <span className="block text-xs text-mute">Unspent money rolls into the next month</span>
          </span>
        </span>
        <span className="relative inline-flex shrink-0">
          <input
            type="checkbox"
            role="switch"
            className="peer sr-only"
            checked={state.carryForward}
            onChange={(e) => dispatch({ type: 'SET_CARRY', value: e.target.checked })}
          />
          <span className="neo-inset block h-7 w-12 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-emerald-400" />
          <span
            className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-gradient-to-br from-slate-200 to-slate-500 shadow-md transition-transform peer-checked:translate-x-5 peer-checked:from-emerald-200 peer-checked:to-emerald-500"
            aria-hidden
          />
        </span>
      </label>
    </div>
  );
}

function Tile({
  icon,
  label,
  sub,
  children,
  onClick,
  valueColor,
  glow,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  children: React.ReactNode;
  onClick?: () => void;
  valueColor?: string;
  glow: string;
}) {
  const body = (
    <>
      <span className="pointer-events-none absolute inset-x-4 top-0 h-px opacity-70" style={{ background: `linear-gradient(90deg, transparent, ${glow}, transparent)` }} aria-hidden />
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ color: glow, background: `${glow}1a`, boxShadow: `0 0 12px ${glow}22` }}>
          {icon}
        </span>
        {label}
      </div>
      <div
        className="tabular truncate font-mono text-[clamp(1.2rem,3.2vw,1.65rem)] font-bold leading-tight"
        style={{ color: valueColor, transition: 'color .5s ease' }}
      >
        {children}
      </div>
      <p className="mt-1 text-xs text-mute">{sub}</p>
    </>
  );
  const cls = 'neo-sm lift relative block w-full p-4 text-left';
  return onClick ? (
    <motion.button type="button" whileTap={{ scale: 0.98 }} className={`${cls} tile-btn`} onClick={onClick}>
      {body}
    </motion.button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
