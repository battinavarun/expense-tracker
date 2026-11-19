import { describe, expect, it } from 'vitest';
import { summarizeMonth } from './calc';
import { buildCSV, csvCell, emptyState as rawEmptyState, sanitizeState } from './storage';
import { daysInMonth, isValidDateKey, shiftMonth } from './dates';
import { parseAmount, formatINR } from './format';
import { reducer } from '../store/store';
import type { AppState } from '../types';

// The app has no built-in budget; these tests simulate a user who chose ₹44,280.
const emptyState = (): AppState => ({ ...rawEmptyState(), defaultBudget: 44280 });

type Row = [date: string, amount: number, categoryId?: string | null];

const withExpenses = (list: Row[], extra: Partial<AppState> = {}): AppState => ({
  ...emptyState(),
  ...extra,
  expenses: list.map(([date, amount, categoryId = null], i) => ({
    id: `e${i}`,
    amount,
    note: '',
    categoryId,
    method: 'UPI' as const,
    date,
  })),
});

describe('dates', () => {
  it('handles month math across years and leap years', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(daysInMonth('2028-02')).toBe(29);
    expect(daysInMonth('2026-02')).toBe(28);
  });
  it('rejects impossible dates', () => {
    expect(isValidDateKey('2026-02-31')).toBe(false);
    expect(isValidDateKey('2026-11-19')).toBe(true);
  });
});

describe('money', () => {
  it('parses what people type', () => {
    expect(parseAmount('1,250')).toBe(1250);
    expect(parseAmount('₹ 80.5')).toBe(80.5);
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('12.345')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
  it('formats in Indian grouping', () => {
    expect(formatINR(44280)).toBe('₹44,280');
    expect(formatINR(123456)).toBe('₹1,23,456');
    expect(formatINR(80.5)).toBe('₹80.50');
  });
});

describe('summarizeMonth', () => {
  it('computes balance and daily safe-to-spend for the current month', () => {
    const s = withExpenses([['2026-11-02', 4280]]);
    const m = summarizeMonth(s, '2026-11', '2026-11-19'); // 12 days left incl. today
    expect(m.available).toBe(44280);
    expect(m.spent).toBe(4280);
    expect(m.remaining).toBe(40000);
    expect(m.daysLeft).toBe(12);
    expect(m.dailySafe).toBeCloseTo(40000 / 12);
  });

  it('has no daily figure for a finished month and full days for a future month', () => {
    const s = emptyState();
    expect(summarizeMonth(s, '2026-10', '2026-11-19').dailySafe).toBeNull();
    const future = summarizeMonth(s, '2026-12', '2026-11-19');
    expect(future.daysLeft).toBe(31);
    expect(future.remaining).toBe(44280);
  });

  it('never goes negative for safe-to-spend when over budget', () => {
    const m = summarizeMonth(withExpenses([['2026-11-03', 50000]]), '2026-11', '2026-11-19');
    expect(m.over).toBe(true);
    expect(m.remaining).toBe(-5720);
    expect(m.dailySafe).toBe(0);
  });

  it('gives each month a fresh budget unless carry-forward is on', () => {
    const base = withExpenses([['2026-10-05', 40000]]);
    expect(summarizeMonth(base, '2026-11', '2026-11-19').available).toBe(44280);
    const carry = summarizeMonth({ ...base, carryForward: true }, '2026-11', '2026-11-19');
    expect(carry.carried).toBe(4280);
    expect(carry.available).toBe(48560);
  });

  it('does not carry negative balances and chains across months', () => {
    const s = withExpenses(
      [
        ['2026-09-01', 50000], // overspent: carries nothing
        ['2026-10-01', 40000], // +4280
      ],
      { carryForward: true },
    );
    expect(summarizeMonth(s, '2026-10', '2026-11-19').carried).toBe(0);
    expect(summarizeMonth(s, '2026-11', '2026-11-19').carried).toBe(4280);
    expect(summarizeMonth(s, '2026-12', '2026-11-19').carried).toBe(48560); // Nov unspent: 44280 + 4280
  });

  it('respects per-month budget overrides', () => {
    const s = { ...emptyState(), budgetOverrides: { '2026-11': 50000 } };
    expect(summarizeMonth(s, '2026-11', '2026-11-19').available).toBe(50000);
    expect(summarizeMonth(s, '2026-12', '2026-11-19').available).toBe(44280);
  });

  it('avoids floating point drift', () => {
    const s = withExpenses([['2026-11-01', 0.1], ['2026-11-01', 0.2]]);
    expect(summarizeMonth(s, '2026-11', '2026-11-19').spent).toBe(0.3);
  });

  it('buckets uncategorized spend and per-category limits', () => {
    const s = withExpenses(
      [['2026-11-01', 300, 'food'], ['2026-11-02', 100, null], ['2026-11-03', 100, 'ghost']],
      { categories: [{ id: 'food', name: 'Food', color: '#38bdf8', limit: 200 }] },
    );
    const m = summarizeMonth(s, '2026-11', '2026-11-19');
    const food = m.stats.find((x) => x.id === 'food')!;
    expect(food.limitRatio).toBe(1.5);
    expect(m.stats.find((x) => x.id === null)!.spent).toBe(200); // null + dangling id
  });
});

describe('money in & insights', () => {
  it('money-in adds to the spendable pool and to carry-forward', () => {
    const s = {
      ...withExpenses([['2026-10-05', 40000]], { carryForward: true }),
      income: [{ id: 'i1', amount: 1000, note: 'Refund', date: '2026-10-10' }],
    };
    const oct = summarizeMonth(s, '2026-10', '2026-11-19');
    expect(oct.available).toBe(45280);
    expect(oct.remaining).toBe(5280);
    expect(summarizeMonth(s, '2026-11', '2026-11-19').carried).toBe(5280);
  });

  it('forecasts month-end spend from the current pace', () => {
    // 3,000 spent in the first 10 days of a 30-day month → ₹9,000 forecast
    const s = withExpenses([['2026-11-03', 3000]]);
    const m = summarizeMonth(s, '2026-11', '2026-11-10');
    expect(m.insights.avgPerDay).toBe(300);
    expect(m.insights.projected).toBe(9000);
    expect(m.insights.projectedLeft).toBe(44280 - 9000);
    expect(m.insights.todaySpent).toBe(0);
    expect(m.insights.noSpendDays).toBe(9);
  });

  it('builds a per-day series with category parts and weekday/method totals', () => {
    const s = withExpenses([['2026-11-02', 100, 'a'], ['2026-11-02', 50, 'a'], ['2026-11-02', 25, null]], {
      categories: [{ id: 'a', name: 'A', color: '#38bdf8', limit: null }],
    });
    const m = summarizeMonth(s, '2026-11', '2026-11-19');
    expect(m.days).toHaveLength(30);
    expect(m.days[1].total).toBe(175);
    expect(m.days[1].parts.map((p) => p.amount).sort((a, b) => a - b)).toEqual([25, 150]);
    expect(m.days[2].future).toBe(false);
    expect(m.days[19].future).toBe(true); // day 20
    expect(m.insights.weekdays[0]).toBe(175); // 2 Nov 2026 is a Monday (Monday-first index 0)
  });

  it('counts an under-pace streak ending today', () => {
    const s = withExpenses([['2026-11-17', 10000]]); // one huge day
    const m = summarizeMonth(s, '2026-11', '2026-11-19');
    expect(m.insights.underPaceStreak).toBe(2); // 18th & 19th
  });
});

describe('reducer', () => {
  it('deleting a category keeps its expenses as uncategorized', () => {
    let s = reducer(emptyState(), { type: 'ADD_CATEGORY', category: { id: 'c1', name: 'Food', color: '#38bdf8', limit: null } });
    s = reducer(s, { type: 'ADD_EXPENSE', expense: { amount: 50, note: 'x', categoryId: 'c1', method: 'UPI', date: '2026-11-01' } });
    s = reducer(s, { type: 'DELETE_CATEGORY', id: 'c1' });
    expect(s.categories).toHaveLength(0);
    expect(s.expenses[0].categoryId).toBeNull();
  });

  it('applies recurring bills once per month', () => {
    let s = reducer(emptyState(), {
      type: 'ADD_RECURRING',
      recurring: { amount: 9000, note: 'Rent', categoryId: null, method: 'UPI', dayOfMonth: 31 },
    });
    s = reducer(s, { type: 'APPLY_RECURRING', month: '2026-11' });
    s = reducer(s, { type: 'APPLY_RECURRING', month: '2026-11' });
    expect(s.expenses).toHaveLength(1);
    expect(s.expenses[0].date).toBe('2026-11-30'); // day 31 clamped to Nov's length
    s = reducer(s, { type: 'APPLY_RECURRING', month: '2026-12' });
    expect(s.expenses).toHaveLength(2);
  });

  it('"all months" budget clears overrides', () => {
    let s = reducer(emptyState(), { type: 'SET_BUDGET', amount: 50000, scope: 'month', month: '2026-11' });
    expect(s.budgetOverrides['2026-11']).toBe(50000);
    s = reducer(s, { type: 'SET_BUDGET', amount: 46000, scope: 'all', month: '2026-11' });
    expect(s.defaultBudget).toBe(46000);
    expect(s.budgetOverrides).toEqual({});
  });
});

describe('import / export safety', () => {
  it('sanitizes hostile or malformed JSON instead of crashing', () => {
    const s = sanitizeState({
      defaultBudget: 'lots',
      categories: [{ id: 'a', name: '  Food  ', color: 'javascript:alert(1)', limit: -5 }, 'junk', { name: '' }],
      expenses: [
        { id: '1', amount: 100, date: '2026-11-05', categoryId: 'nope', method: 'Bitcoin', note: 'ok' },
        { id: '2', amount: -1, date: '2026-11-05' },
        { id: '3', amount: 5, date: '2026-13-45' },
        null,
      ],
      recurring: [{ amount: 10, note: 'x', dayOfMonth: 99 }],
    });
    expect(s.defaultBudget).toBeNull(); // an invalid budget is "not set", never silently replaced by a default
    expect(s.categories).toEqual([{ id: 'a', name: 'Food', color: '#38bdf8', limit: null }]);
    expect(s.expenses).toHaveLength(1);
    expect(s.expenses[0]).toMatchObject({ categoryId: null, method: 'UPI' });
    expect(s.recurring[0].dayOfMonth).toBe(1);
    expect(sanitizeState('garbage')).toEqual(rawEmptyState());
    expect(rawEmptyState().defaultBudget).toBeNull();
  });

  it('round-trips through JSON', () => {
    const s = withExpenses([['2026-11-05', 120.5]], { carryForward: true });
    expect(sanitizeState(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('neutralises spreadsheet formulas and escapes CSV', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('plain')).toBe('plain');
    const csv = buildCSV(withExpenses([['2026-11-05', 99]]), '2026-11');
    expect(csv.split('\r\n')).toHaveLength(2);
  });
});
