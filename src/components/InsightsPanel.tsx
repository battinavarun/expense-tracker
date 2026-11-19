import { motion } from 'framer-motion';
import { Award, Banknote, CreditCard, Flame, Leaf, Smartphone, Sparkles, Star, Trophy } from 'lucide-react';
import type { MonthSummary } from '../lib/calc';
import { CORAL, EMERALD } from '../lib/colors';
import { formatDay } from '../lib/dates';
import { formatCompact, formatINR, formatINRWhole, formatPercent } from '../lib/format';
import type { PaymentMethod } from '../types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const METHOD_STYLE: Record<PaymentMethod, { color: string; icon: JSX.Element }> = {
  UPI: { color: '#38bdf8', icon: <Smartphone size={13} /> },
  Card: { color: '#a78bfa', icon: <CreditCard size={13} /> },
  Cash: { color: '#facc15', icon: <Banknote size={13} /> },
};

export function InsightsPanel({ summary }: { summary: MonthSummary }) {
  const ins = summary.insights;
  const hasData = summary.expenses.length > 0;

  const badges: Array<{ icon: JSX.Element; label: string; tone: string }> = [];
  if (ins.underPaceStreak >= 3) badges.push({ icon: <Flame size={14} />, label: `${ins.underPaceStreak}-day under-pace streak`, tone: '#fb923c' });
  if (ins.noSpendDays >= 1) badges.push({ icon: <Leaf size={14} />, label: `${ins.noSpendDays} no-spend day${ins.noSpendDays === 1 ? '' : 's'}`, tone: EMERALD });
  if (ins.projectedLeft !== null && ins.projectedLeft >= 0 && ins.elapsed >= 5 && hasData)
    badges.push({ icon: <Trophy size={14} />, label: 'On pace to finish under budget', tone: '#facc15' });
  if (summary.expenses.length >= 20) badges.push({ icon: <Star size={14} />, label: `${summary.expenses.length} entries tracked`, tone: '#a78bfa' });
  if (ins.elapsed >= 7 && summary.expenses.length >= ins.elapsed) badges.push({ icon: <Award size={14} />, label: 'Logging daily', tone: '#38bdf8' });

  const maxDay = Math.max(1, ...summary.days.map((d) => d.total), ins.pace * 1.2);
  const maxWd = Math.max(1, ...ins.weekdays);
  const methodTotal = ins.methods.UPI + ins.methods.Card + ins.methods.Cash;

  return (
    <section className="neo p-4 sm:p-5" aria-label="Insights">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-mute">
          <Sparkles size={14} className="text-emerald-300" /> Insights
        </h2>
        {ins.pace > 0 && <span className="text-[11px] text-mute">Even pace: {formatINRWhole(ins.pace)}/day</span>}
      </div>

      {!hasData ? (
        <p className="neo-inset px-5 py-8 text-center text-sm text-mute">Log a few expenses and patterns will show up here — daily pace, weekday habits and payment mix.</p>
      ) : (
        <div className="space-y-6">
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label="Achievements">
              {badges.map((b) => (
                <motion.span
                  key={b.label}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="chip !cursor-default !px-3 !py-1.5 text-xs"
                  style={{ color: b.tone }}
                >
                  {b.icon}
                  {b.label}
                </motion.span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Mini label="Average / day" value={formatINRWhole(ins.avgPerDay)} sub={`over ${ins.elapsed} day${ins.elapsed === 1 ? '' : 's'}`} />
            <Mini
              label="Biggest expense"
              value={ins.biggest ? formatINR(ins.biggest.amount) : '—'}
              sub={ins.biggest ? `${ins.biggest.note || 'Expense'} · ${formatDay(ins.biggest.date)}` : ''}
            />
            <Mini
              label="Top category"
              value={ins.topCategory?.name ?? '—'}
              sub={ins.topCategory ? `${formatINR(ins.topCategory.spent)} · ${formatPercent(ins.topCategory.shareOfBudget)}` : ''}
              dot={ins.topCategory?.color}
            />
            <Mini
              label="Spending days"
              value={`${summary.days.filter((d) => d.total > 0).length}`}
              sub={`${ins.noSpendDays} no-spend`}
            />
          </div>

          {/* Daily strip */}
          <div>
            <p className="label">Every day this month</p>
            <div className="neo-inset flex h-24 items-end gap-[3px] px-3 pb-2 pt-3" role="img" aria-label="Spend per day this month">
              {summary.days.map((d) => {
                const h = d.total > 0 ? Math.max(6, (d.total / maxDay) * 100) : 3;
                const over = ins.pace > 0 && d.total > ins.pace + 0.005;
                return (
                  <motion.div
                    key={d.day}
                    title={`${formatDay(d.date)} · ${d.total > 0 ? formatINR(d.total) : 'no spend'}`}
                    className="relative flex-1 rounded-t-[4px]"
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ type: 'spring', stiffness: 160, damping: 20, delay: d.day * 0.01 }}
                    style={{
                      background: d.future ? '#232830' : d.total === 0 ? `${EMERALD}66` : over ? `linear-gradient(180deg, ${CORAL}, #b94a4a)` : `linear-gradient(180deg, #34d399, #0f9f73)`,
                      boxShadow: d.isToday ? '0 0 0 1.5px #fff' : undefined,
                    }}
                  />
                );
              })}
            </div>
            <div className="mt-1 flex justify-between px-1 text-[10px] text-mute">
              <span>1</span>
              <span>{Math.round(summary.days.length / 2)}</span>
              <span>{summary.days.length}</span>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Weekday habits */}
            <div>
              <p className="label">Weekday habits</p>
              <div className="flex h-28 items-end gap-2">
                {ins.weekdays.map((v, i) => {
                  const peak = v > 0 && v === maxWd;
                  return (
                    <div key={WEEKDAYS[i]} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                      <span className="tabular whitespace-nowrap font-mono text-[9px] text-mute sm:text-[10px]">{v > 0 ? formatCompact(v) : ''}</span>
                      <motion.div
                        className="w-full rounded-t-lg"
                        initial={{ height: 0 }}
                        animate={{ height: `${v > 0 ? Math.max(6, (v / maxWd) * 78) : 3}%` }}
                        transition={{ type: 'spring', stiffness: 140, damping: 18, delay: i * 0.04 }}
                        style={{
                          background: peak ? 'linear-gradient(180deg, #fbbf24, #d97706)' : 'linear-gradient(180deg, #6b7686, #3a424e)',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 3px 3px 8px rgba(0,0,0,0.4)',
                        }}
                      />
                      <span className={`text-[10px] font-semibold ${peak ? 'text-amber-300' : 'text-mute'}`}>{WEEKDAYS[i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment mix */}
            <div>
              <p className="label">How you paid</p>
              <div className="neo-inset flex h-4 overflow-hidden !rounded-full">
                {(Object.keys(METHOD_STYLE) as PaymentMethod[]).map((m) =>
                  ins.methods[m] > 0 ? (
                    <motion.div
                      key={m}
                      initial={{ width: 0 }}
                      animate={{ width: `${(ins.methods[m] / methodTotal) * 100}%` }}
                      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                      style={{ background: METHOD_STYLE[m].color }}
                      title={`${m} ${formatINR(ins.methods[m])}`}
                    />
                  ) : null,
                )}
              </div>
              <ul className="mt-3 space-y-2">
                {(Object.keys(METHOD_STYLE) as PaymentMethod[]).map((m) => (
                  <li key={m} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2" style={{ color: METHOD_STYLE[m].color }}>
                      {METHOD_STYLE[m].icon}
                      <span className="text-ink">{m}</span>
                    </span>
                    <span className="tabular font-mono text-xs">
                      {formatINR(ins.methods[m])} <span className="text-mute">· {formatPercent(methodTotal > 0 ? ins.methods[m] / methodTotal : 0)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Mini({ label, value, sub, dot }: { label: string; value: string; sub: string; dot?: string }) {
  return (
    <div className="neo-sm lift min-w-0 p-3 sm:p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mute">{label}</p>
      <p className="mt-1 flex items-center gap-2 font-mono text-sm font-bold sm:text-base">
        {dot && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dot, boxShadow: `0 0 8px ${dot}` }} />}
        {/* names may be clipped with "…"; money is never clipped, it wraps */}
        <span className="min-w-0 break-words" title={value}>
          {value}
        </span>
      </p>
      <p className="mt-0.5 truncate text-[11px] text-mute">{sub}</p>
    </div>
  );
}
