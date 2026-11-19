import type { DateKey, MonthKey } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local-time 'YYYY-MM-DD' (never UTC — avoids the classic off-by-one-day bug in IST). */
export function toDateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(): DateKey {
  return toDateKey(new Date());
}

export function monthOf(date: DateKey): MonthKey {
  return date.slice(0, 7);
}

export function currentMonthKey(): MonthKey {
  return monthOf(todayKey());
}

export function parseMonth(key: MonthKey): { year: number; month: number } {
  const [y, m] = key.split('-').map(Number);
  return { year: y, month: m };
}

export function makeMonthKey(year: number, month: number): MonthKey {
  return `${year}-${pad(month)}`;
}

export function shiftMonth(key: MonthKey, delta: number): MonthKey {
  const { year, month } = parseMonth(key);
  const idx = year * 12 + (month - 1) + delta;
  return makeMonthKey(Math.floor(idx / 12), (idx % 12) + 1);
}

export function compareMonths(a: MonthKey, b: MonthKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function daysInMonth(key: MonthKey): number {
  const { year, month } = parseMonth(key);
  return new Date(year, month, 0).getDate();
}

export function monthLabel(key: MonthKey, style: 'short' | 'long' = 'short'): string {
  const { year, month } = parseMonth(key);
  return new Intl.DateTimeFormat('en-IN', { month: style, year: 'numeric' }).format(new Date(year, month - 1, 1));
}

export function formatDay(date: DateKey): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d));
}

export function formatDayLong(date: DateKey): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(y, m - 1, d),
  );
}

/** Day-of-month clamped to the month length, as a DateKey inside `month`. */
export function dateInMonth(month: MonthKey, day: number): DateKey {
  const clamped = Math.min(Math.max(1, Math.floor(day)), daysInMonth(month));
  return `${month}-${pad(clamped)}`;
}

/** Strict validity check for 'YYYY-MM-DD' (rejects 2026-02-31 etc). */
export function isValidDateKey(s: unknown): s is DateKey {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (y < 2000 || y > 2100) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function isValidMonthKey(s: unknown): s is MonthKey {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}$/.test(s)) return false;
  const { year, month } = parseMonth(s);
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12;
}
