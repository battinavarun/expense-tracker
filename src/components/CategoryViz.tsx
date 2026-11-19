import { lazy, Suspense, useEffect, useState } from 'react';
import { BarChart3, Box, CalendarDays, Disc3, MousePointerClick } from 'lucide-react';
import type { CategoryStat, DayPoint, MonthSummary } from '../lib/calc';
import { CORAL } from '../lib/colors';
import { formatDayLong } from '../lib/dates';
import { formatINR, formatPercent } from '../lib/format';
import { statKey } from '../lib/keys';
import type { ViewMode } from '../types';
import { ErrorBoundary } from './ErrorBoundary';
import type { VizMode } from './Scene3D';

// three.js + R3F only download when the 3D view is actually shown.
const Scene3D = lazy(() => import('./Scene3D'));

interface Props {
  summary: MonthSummary;
  viewMode: ViewMode;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}

const MODES: Array<{ id: VizMode; label: string; icon: JSX.Element; hint: string }> = [
  { id: 'pillars', label: 'Pillars', icon: <BarChart3 size={14} />, hint: 'tap a pillar' },
  { id: 'ring', label: 'Ring', icon: <Disc3 size={14} />, hint: 'tap a slice' },
  { id: 'timeline', label: 'Days', icon: <CalendarDays size={14} />, hint: 'tap a day' },
];

export function CategoryViz({ summary, viewMode, selectedKey, onSelect }: Props) {
  const [mode, setMode] = useState<VizMode>('pillars');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const selected = summary.stats.find((s) => statKey(s) === selectedKey) ?? null;
  const day = selectedDay !== null ? (summary.days.find((d) => d.day === selectedDay) ?? null) : null;
  const compact = <CompactBars stats={summary.stats} selectedKey={selectedKey} onSelect={onSelect} />;

  // A different month has different days.
  useEffect(() => setSelectedDay(null), [summary.month]);

  const hint = MODES.find((m) => m.id === mode)?.hint;

  return (
    <section className="neo p-4 sm:p-5" aria-label="Spending visualisation">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-mute">Where your money went</h2>
        {viewMode === 'interactive' && (
          <div role="radiogroup" aria-label="3D chart type" className="neo-inset flex gap-1 p-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={mode === m.id}
                className="chip !rounded-xl !px-2.5 !py-1.5 text-xs"
                onClick={() => {
                  setMode(m.id);
                  onSelect(null);
                  setSelectedDay(null);
                }}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {viewMode === 'interactive' ? (
        <>
          <div className="neo-inset relative h-[300px] overflow-hidden !rounded-2xl sm:h-[380px]">
            <ErrorBoundary fallback={<Fallback>{compact}</Fallback>}>
              <Suspense fallback={<LoadingScene />}>
                <Scene3D
                  mode={mode}
                  stats={summary.stats}
                  available={summary.available}
                  remaining={summary.remaining}
                  accent={summary.accent}
                  days={summary.days}
                  pace={summary.insights.pace}
                  selectedKey={selectedKey}
                  onSelect={onSelect}
                  selectedDay={selectedDay}
                  onSelectDay={setSelectedDay}
                />
              </Suspense>
            </ErrorBoundary>
            <span className="pointer-events-none absolute bottom-2 left-3 flex items-center gap-1.5 text-[11px] text-mute">
              <MousePointerClick size={12} /> drag to rotate · {hint}
            </span>
            {summary.stats.length === 0 && mode !== 'timeline' && (
              <div className="pointer-events-none absolute inset-x-0 top-4 text-center text-xs text-mute">
                Create a category and log an expense — the chart grows as you spend.
              </div>
            )}
          </div>
          {mode !== 'timeline' && summary.stats.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Select a pillar">
              {summary.stats.map((s) => {
                const key = statKey(s);
                return (
                  <button
                    key={key}
                    type="button"
                    className="chip !px-2.5 !py-1.5 text-xs"
                    style={{ ['--chip' as string]: s.color }}
                    aria-pressed={selectedKey === key}
                    onClick={() => onSelect(selectedKey === key ? null : key)}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        compact
      )}

      {viewMode === 'interactive' && mode === 'timeline' ? (
        <DayInspector day={day} summary={summary} />
      ) : (
        <Inspector stat={selected} available={summary.available} />
      )}
    </section>
  );
}

function DayInspector({ day, summary }: { day: DayPoint | null; summary: MonthSummary }) {
  if (!day) {
    return (
      <p className="mt-4 text-center text-xs text-mute">
        Each bar is a day, stacked by category. Bars above the glowing line spent more than an even share of {formatINR(summary.insights.pace)}.
      </p>
    );
  }
  const list = summary.expenses.filter((e) => e.date === day.date);
  const over = summary.insights.pace > 0 && day.total > summary.insights.pace + 0.005;
  return (
    <div className="neo-inset mt-4 p-4" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold">{formatDayLong(day.date)}</span>
        <span className="tabular font-mono text-lg font-bold" style={{ color: over ? CORAL : undefined }}>
          {formatINR(day.total)}
        </span>
      </div>
      {list.length === 0 ? (
        <p className="mt-2 text-xs text-mute">{day.future ? 'Upcoming day.' : 'No spend — nice.'}</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {list.slice(0, 6).map((e) => {
            const part = day.parts.find((p) => p.key === (e.categoryId ?? '__none__')) ?? day.parts[0];
            return (
              <li key={e.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: part?.color }} />
                  <span className="truncate">{e.note || part?.name || 'Expense'}</span>
                </span>
                <span className="tabular font-mono">{formatINR(e.amount)}</span>
              </li>
            );
          })}
          {list.length > 6 && <li className="text-[11px] text-mute">+ {list.length - 6} more</li>}
        </ul>
      )}
    </div>
  );
}

function Inspector({ stat, available }: { stat: CategoryStat | null; available: number }) {
  if (!stat) {
    return <p className="mt-4 text-center text-xs text-mute">Select a category to inspect how much of your budget it has used.</p>;
  }
  const over = stat.limitRatio !== null && stat.limitRatio > 1;
  return (
    <div className="neo-inset mt-4 p-4" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-bold">
          <span className="h-3 w-3 rounded-full" style={{ background: stat.color, boxShadow: `0 0 10px ${stat.color}` }} />
          {stat.name}
        </span>
        <span className="tabular font-mono text-lg font-bold">{formatINR(stat.spent)}</span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
        <div>
          <dt className="text-mute">Of budget</dt>
          <dd className="tabular mt-0.5 font-mono font-semibold">{formatPercent(stat.shareOfBudget)}</dd>
        </div>
        <div>
          <dt className="text-mute">Limit</dt>
          <dd className="tabular mt-0.5 font-mono font-semibold">{stat.limit ? formatINR(stat.limit) : 'None set'}</dd>
        </div>
        <div>
          <dt className="text-mute">{stat.limit ? (over ? 'Over by' : 'Left') : 'Entries'}</dt>
          <dd className="tabular mt-0.5 font-mono font-semibold" style={{ color: over ? CORAL : undefined }}>
            {stat.limit ? formatINR(Math.abs(stat.limit - stat.spent)) : stat.count}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] text-mute">
        {formatINR(stat.spent)} of your {formatINR(available)} · {stat.count} entr{stat.count === 1 ? 'y' : 'ies'}
      </p>
    </div>
  );
}

function CompactBars({ stats, selectedKey, onSelect }: { stats: CategoryStat[]; selectedKey: string | null; onSelect: (k: string | null) => void }) {
  if (stats.length === 0) {
    return (
      <div className="neo-inset px-5 py-10 text-center text-sm text-mute">
        Your categories will appear here as bars once you add them.
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {stats.map((s) => {
        const key = statKey(s);
        const over = s.limitRatio !== null && s.limitRatio > 1;
        return (
          <li key={key}>
            <button
              type="button"
              className={`w-full rounded-xl p-2 text-left transition ${selectedKey === key ? 'bg-white/5' : 'hover:bg-white/[0.03]'}`}
              aria-pressed={selectedKey === key}
              onClick={() => onSelect(selectedKey === key ? null : key)}
            >
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </span>
                <span className="tabular font-mono text-xs">
                  {formatINR(s.spent)} <span className="text-mute">· {formatPercent(s.shareOfBudget)}</span>
                </span>
              </div>
              <div className="neo-inset relative h-3 overflow-hidden !rounded-full">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${Math.min(1, s.shareOfBudget) * 100}%`, background: `linear-gradient(90deg, ${s.color}aa, ${s.color})` }}
                />
              </div>
              {s.limit && (
                <p className="mt-1 text-[11px]" style={{ color: over ? CORAL : '#8b95a5' }}>
                  {over ? `Over limit of ${formatINR(s.limit)}` : `Limit ${formatINR(s.limit)} · ${formatPercent(s.limitRatio ?? 0)} used`}
                </p>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Fallback({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto p-4">
      <p className="mb-3 text-xs text-amber-300">3D isn’t available on this device — showing the compact view.</p>
      {children}
    </div>
  );
}

function LoadingScene() {
  return (
    <div className="flex h-full items-center justify-center gap-2 text-xs text-mute">
      <Box size={16} className="animate-pulse" /> Loading 3D scene…
    </div>
  );
}
