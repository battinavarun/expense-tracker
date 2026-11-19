import {
  PAYMENT_METHODS,
  type AppState,
  type Category,
  type Expense,
  type PaymentMethod,
  type Recurring,
} from '../types';
import { isHexColor } from './colors';
import { isValidDateKey, isValidMonthKey, monthLabel, monthOf } from './dates';
import { round2 } from './format';

export const STORAGE_KEY = 'rupee-vault:v1';

export function emptyState(): AppState {
  return {
    version: 2,
    defaultBudget: null,
    budgetOverrides: {},
    carryForward: false,
    viewMode: 'interactive',
    categories: [],
    expenses: [],
    income: [],
    recurring: [],
  };
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const money = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 && n <= 1e9 ? round2(n) : null;
};
const method = (v: unknown): PaymentMethod =>
  PAYMENT_METHODS.includes(v as PaymentMethod) ? (v as PaymentMethod) : 'UPI';

/**
 * Turns untrusted JSON (localStorage or an imported file) into a valid AppState.
 * Never throws; drops anything malformed rather than crashing the app.
 */
export function sanitizeState(raw: unknown): AppState {
  const base = emptyState();
  if (!isObj(raw)) return base;

  // Only budgets written by this schema version are trusted. Older versions pre-filled ₹44,280 and auto-saved it,
  // so a stored v1 budget may never have been chosen by the user — drop it (data is kept) and ask again.
  const trustBudget = raw.version === 2;
  base.defaultBudget = trustBudget ? money(raw.defaultBudget) : null;

  if (trustBudget && isObj(raw.budgetOverrides)) {
    for (const [k, v] of Object.entries(raw.budgetOverrides)) {
      const m = money(v);
      if (isValidMonthKey(k) && m !== null) base.budgetOverrides[k] = m;
    }
  }

  base.carryForward = raw.carryForward === true;
  base.viewMode = raw.viewMode === 'compact' ? 'compact' : 'interactive';

  const catIds = new Set<string>();
  if (Array.isArray(raw.categories)) {
    for (const c of raw.categories.slice(0, 200)) {
      if (!isObj(c)) continue;
      const name = str(c.name, 40);
      const id = str(c.id, 80) || newId();
      if (!name || catIds.has(id)) continue;
      catIds.add(id);
      const cat: Category = {
        id,
        name,
        color: isHexColor(c.color) ? c.color : '#38bdf8',
        limit: money(c.limit),
      };
      base.categories.push(cat);
    }
  }

  const expIds = new Set<string>();
  if (Array.isArray(raw.expenses)) {
    for (const e of raw.expenses.slice(0, 50000)) {
      if (!isObj(e)) continue;
      const amount = money(e.amount);
      if (amount === null || !isValidDateKey(e.date)) continue;
      let id = str(e.id, 80) || newId();
      if (expIds.has(id)) id = newId();
      expIds.add(id);
      const categoryId = typeof e.categoryId === 'string' && catIds.has(e.categoryId) ? e.categoryId : null;
      const exp: Expense = {
        id,
        amount,
        note: str(e.note, 120),
        categoryId,
        method: method(e.method),
        date: e.date,
      };
      const rid = str(e.recurringId, 80);
      if (rid) exp.recurringId = rid;
      base.expenses.push(exp);
    }
  }

  const incIds = new Set<string>();
  if (Array.isArray(raw.income)) {
    for (const i of raw.income.slice(0, 5000)) {
      if (!isObj(i)) continue;
      const amount = money(i.amount);
      if (amount === null || !isValidDateKey(i.date)) continue;
      let id = str(i.id, 80) || newId();
      if (incIds.has(id)) id = newId();
      incIds.add(id);
      base.income.push({ id, amount, note: str(i.note, 120), date: i.date });
    }
  }

  const recIds = new Set<string>();
  if (Array.isArray(raw.recurring)) {
    for (const r of raw.recurring.slice(0, 200)) {
      if (!isObj(r)) continue;
      const amount = money(r.amount);
      if (amount === null) continue;
      const id = str(r.id, 80) || newId();
      if (recIds.has(id)) continue;
      recIds.add(id);
      const day = Number(r.dayOfMonth);
      const rec: Recurring = {
        id,
        amount,
        note: str(r.note, 120),
        categoryId: typeof r.categoryId === 'string' && catIds.has(r.categoryId) ? r.categoryId : null,
        method: method(r.method),
        dayOfMonth: Number.isInteger(day) && day >= 1 && day <= 31 ? day : 1,
      };
      base.recurring.push(rec);
    }
  }

  return base;
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return sanitizeState(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

/** Returns false if the browser refused (quota, private mode, …). */
export function saveState(state: AppState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- exports

function download(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function exportJSON(state: AppState) {
  download(`rupee-vault-backup-${stamp()}.json`, 'application/json', JSON.stringify(state, null, 2));
}

/** Neutralise spreadsheet formula injection and quote per RFC 4180. */
export function csvCell(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCSV(state: AppState, month?: string): string {
  const catName = new Map(state.categories.map((c) => [c.id, c.name]));
  const rows = state.expenses
    .filter((e) => !month || monthOf(e.date) === month)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const incomeRows = state.income
    .filter((i) => !month || monthOf(i.date) === month)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const header = ['Date', 'Month', 'Type', 'Amount (INR)', 'Note', 'Category', 'Payment Method'];
  const lines = [header.join(',')];
  const all: Array<{ date: string; cells: Array<string | number> }> = [
    ...rows.map((e) => ({
      date: e.date,
      cells: [
        e.date,
        monthLabel(monthOf(e.date)),
        'Expense',
        e.amount,
        e.note,
        (e.categoryId && catName.get(e.categoryId)) || 'Uncategorized',
        e.method,
      ],
    })),
    ...incomeRows.map((i) => ({
      date: i.date,
      cells: [i.date, monthLabel(monthOf(i.date)), 'Money in', i.amount, i.note, '', ''],
    })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const r of all) lines.push(r.cells.map(csvCell).join(','));
  return lines.join('\r\n');
}

export function exportCSV(state: AppState, month?: string) {
  // BOM so Excel reads UTF-8 correctly.
  download(
    `rupee-vault-${month ?? 'all-months'}.csv`,
    'text/csv;charset=utf-8',
    '﻿' + buildCSV(state, month),
  );
}
