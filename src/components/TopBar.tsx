import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  LayoutList,
  Repeat,
  Trash2,
  Upload,
  Box,
} from 'lucide-react';
import type { MonthKey, ViewMode } from '../types';
import { currentMonthKey, monthLabel, shiftMonth } from '../lib/dates';
import { emptyState, exportCSV, exportJSON } from '../lib/storage';
import { useStore } from '../store/store';
import { useToast } from './Toast';
import { useBackupImport } from './useBackupImport';

interface TopBarProps {
  month: MonthKey;
  onMonthChange: (m: MonthKey) => void;
  onOpenRecurring: () => void;
}

export function TopBar({ month, onMonthChange, onOpenRecurring }: TopBarProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="neo-sm flex h-11 w-11 items-center justify-center text-lg font-extrabold text-emerald-300">₹</div>
        <div className="leading-tight">
          <h1 className="text-gradient text-xl font-extrabold tracking-tight">Rupee Vault</h1>
          <p className="text-xs text-mute">Monthly expense tracker</p>
        </div>
      </div>

      <div className="order-3 flex w-full justify-center sm:order-none sm:w-auto">
        <MonthSwitcher month={month} onChange={onMonthChange} />
      </div>

      <div className="flex items-center gap-2">
        <ViewToggle />
        <button type="button" className="btn btn-icon" onClick={onOpenRecurring} aria-label="Recurring expenses" title="Recurring expenses">
          <Repeat size={18} />
        </button>
        <DataMenu month={month} />
      </div>
    </header>
  );
}

function MonthSwitcher({ month, onChange }: { month: MonthKey; onChange: (m: MonthKey) => void }) {
  const isCurrent = month === currentMonthKey();
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="btn btn-icon" onClick={() => onChange(shiftMonth(month, -1))} aria-label="Previous month">
        <ChevronLeft size={18} />
      </button>
      <div className="neo-inset flex min-w-[10.5rem] items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold">
        <CalendarDays size={15} className="text-mute" />
        <span aria-live="polite">{monthLabel(month, 'long')}</span>
      </div>
      <button type="button" className="btn btn-icon" onClick={() => onChange(shiftMonth(month, 1))} aria-label="Next month">
        <ChevronRight size={18} />
      </button>
      {!isCurrent && (
        <button type="button" className="btn btn-sm" onClick={() => onChange(currentMonthKey())}>
          Today
        </button>
      )}
    </div>
  );
}

function ViewToggle() {
  const { state, dispatch } = useStore();
  const set = (value: ViewMode) => dispatch({ type: 'SET_VIEW', value });
  const opt = (value: ViewMode, label: string, icon: JSX.Element) => (
    <button
      type="button"
      role="radio"
      aria-checked={state.viewMode === value}
      className="chip !rounded-xl !px-3 !py-2 text-xs"
      onClick={() => set(value)}
      title={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
  return (
    <div role="radiogroup" aria-label="View mode" className="neo-inset flex gap-1 p-1">
      {opt('interactive', '3D', <Box size={15} />)}
      {opt('compact', 'Compact', <LayoutList size={15} />)}
    </div>
  );
}

function DataMenu({ month }: { month: MonthKey }) {
  const { state, dispatch, persisted } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const importBackup = useBackupImport();
  const onImport = async (file: File | undefined) => {
    if (await importBackup(file)) setOpen(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const item = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/5';

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        className="btn btn-icon"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Backup and data"
        title="Backup & data"
      >
        <Database size={18} />
        {!persisted && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-400" />}
      </button>
      {open && (
        <div role="menu" className="neo absolute right-0 z-40 mt-2 w-72 p-2">
          {!persisted && (
            <p className="mb-1 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300">
              Your browser is blocking storage — changes will be lost on refresh. Export a backup now.
            </p>
          )}
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">Export</p>
          <button role="menuitem" className={item} onClick={() => exportCSV(state, month)}>
            <FileSpreadsheet size={16} className="text-emerald-300" /> CSV · this month
          </button>
          <button role="menuitem" className={item} onClick={() => exportCSV(state)}>
            <Download size={16} className="text-emerald-300" /> CSV · all months
          </button>
          <button role="menuitem" className={item} onClick={() => exportJSON(state)}>
            <FileJson size={16} className="text-sky-300" /> JSON · full backup
          </button>
          <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">Restore</p>
          <button role="menuitem" className={item} onClick={() => fileRef.current?.click()}>
            <Upload size={16} className="text-sky-300" /> Import JSON backup…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => onImport(e.target.files?.[0])}
          />
          <div className="my-2 h-px bg-white/5" />
          <button
            role="menuitem"
            className={`${item} text-red-300`}
            onClick={() => {
              if (window.confirm('Erase ALL categories, expenses and settings from this browser? This cannot be undone.')) {
                dispatch({ type: 'REPLACE_ALL', state: emptyState() });
                toast('All data erased');
                setOpen(false);
              }
            }}
          >
            <Trash2 size={16} /> Erase all data…
          </button>
        </div>
      )}
    </div>
  );
}
