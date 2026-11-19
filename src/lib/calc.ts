import type { AppState, Category, DateKey, Expense, Income, MonthKey, PaymentMethod } from '../types';
import { compareMonths, daysInMonth, monthOf, shiftMonth, todayKey } from './dates';
import { round2 } from './format';
import { NONE_KEY } from './keys';
import { healthColor, healthLabel } from './colors';

export interface CategoryStat {
  /** null id = Uncategorized */
  id: string | null;
  name: string;
  color: string;
  limit: number | null;
  spent: number;
  count: number;
  /** spent / month budget, 0..∞ */
  shareOfBudget: number;
  /** spent / limit when a limit exists */
  limitRatio: number | null;
}

export interface DayPart {
  key: string;
  name: string;
  color: string;
  amount: number;
}

export interface DayPoint {
  day: number;
  date: DateKey;
  total: number;
  count: number;
  parts: DayPart[];
  /** Day hasn't happened yet. */
  future: boolean;
  isToday: boolean;
}

export interface Insights {
  /** Days of the month that have (at least partly) happened. */
  elapsed: number;
  avgPerDay: number;
  /** Month-end spend if the current pace continues; null for future months. */
  projected: number | null;
  /** available − projected; null when projected is null. */
  projectedLeft: number | null;
  /** Even daily pace: available / days in month. */
  pace: number;
  noSpendDays: number;
  /** Consecutive days (ending today / month end) at or under the even pace. */
  underPaceStreak: number;
  biggest: Expense | null;
  topCategory: CategoryStat | null;
  methods: Record<PaymentMethod, number>;
  /** Spend per weekday, Monday first. */
  weekdays: number[];
  todaySpent: number;
}

export interface MonthSummary {
  month: MonthKey;
  /** False until the user has entered a budget — everything then reads ₹0. */
  budgetSet: boolean;
  /** Health colour for glows/accents (neutral slate while no budget is set). */
  accent: string;
  /** Short status word for the card ("On track", "Set your budget", …). */
  status: string;
  /** The budget set for this month (override or default). */
  baseBudget: number;
  /** Leftover brought in from earlier months (0 when carry-forward is off). */
  carried: number;
  /** Money-in logged this month. */
  income: number;
  incomeEntries: Income[];
  /** baseBudget + carried + income */
  available: number;
  spent: number;
  remaining: number;
  /** remaining / available */
  ratio: number;
  over: boolean;
  /** Days left including today; 0 for a finished month. */
  daysLeft: number;
  /** null when the month is over. */
  dailySafe: number | null;
  stats: CategoryStat[];
  expenses: Expense[];
  days: DayPoint[];
  insights: Insights;
}

export const UNCATEGORIZED_COLOR = '#64748b';

export function budgetFor(state: Pick<AppState, 'defaultBudget' | 'budgetOverrides'>, month: MonthKey): number {
  const o = state.budgetOverrides[month];
  return typeof o === 'number' && Number.isFinite(o) ? o : (state.defaultBudget ?? 0);
}

function sum(list: Array<{ amount: number }>): number {
  return round2(list.reduce((s, e) => s + e.amount, 0));
}

/** Leftover rolling into `month`, starting from the earliest month that has any activity. */
export function carriedInto(state: AppState, month: MonthKey): number {
  if (!state.carryForward || (state.expenses.length === 0 && state.income.length === 0)) return 0;
  const spentBy = new Map<MonthKey, number>();
  const incomeBy = new Map<MonthKey, number>();
  let earliest: MonthKey | null = null;
  const note = (m: MonthKey) => {
    if (earliest === null || compareMonths(m, earliest) < 0) earliest = m;
  };
  for (const e of state.expenses) {
    const m = monthOf(e.date);
    spentBy.set(m, round2((spentBy.get(m) ?? 0) + e.amount));
    note(m);
  }
  for (const i of state.income) {
    const m = monthOf(i.date);
    incomeBy.set(m, round2((incomeBy.get(m) ?? 0) + i.amount));
    note(m);
  }
  if (earliest === null || compareMonths(month, earliest) <= 0) return 0;

  let running = 0;
  let m: MonthKey = earliest;
  let guard = 0;
  while (compareMonths(m, month) < 0 && guard++ < 1300) {
    const avail = budgetFor(state, m) + running + (incomeBy.get(m) ?? 0);
    running = Math.max(0, round2(avail - (spentBy.get(m) ?? 0)));
    m = shiftMonth(m, 1);
  }
  return running;
}

const pad = (n: number) => String(n).padStart(2, '0');

function buildDays(month: MonthKey, expenses: Expense[], categories: Category[], today: DateKey): DayPoint[] {
  const dim = daysInMonth(month);
  const thisMonth = monthOf(today);
  const todayDay = Number(today.slice(8, 10));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const byDay = new Map<number, Expense[]>();
  for (const e of expenses) {
    const d = Number(e.date.slice(8, 10));
    const list = byDay.get(d);
    if (list) list.push(e);
    else byDay.set(d, [e]);
  }
  const days: DayPoint[] = [];
  for (let day = 1; day <= dim; day++) {
    const list = byDay.get(day) ?? [];
    const parts = new Map<string, DayPart>();
    for (const e of list) {
      const cat = e.categoryId ? catById.get(e.categoryId) : undefined;
      const key = cat ? cat.id : NONE_KEY;
      const p = parts.get(key) ?? { key, name: cat?.name ?? 'Uncategorized', color: cat?.color ?? UNCATEGORIZED_COLOR, amount: 0 };
      p.amount = round2(p.amount + e.amount);
      parts.set(key, p);
    }
    const future = month === thisMonth ? day > todayDay : compareMonths(month, thisMonth) > 0;
    days.push({
      day,
      date: `${month}-${pad(day)}`,
      total: sum(list),
      count: list.length,
      parts: [...parts.values()],
      future,
      isToday: month === thisMonth && day === todayDay,
    });
  }
  return days;
}

export function summarizeMonth(state: AppState, month: MonthKey, today: string = todayKey()): MonthSummary {
  const expenses = state.expenses
    .filter((e) => monthOf(e.date) === month)
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
  const incomeEntries = state.income
    .filter((i) => monthOf(i.date) === month)
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));

  const baseBudget = budgetFor(state, month);
  const carried = carriedInto(state, month);
  const income = sum(incomeEntries);
  const available = round2(baseBudget + carried + income);
  const spent = sum(expenses);
  const remaining = round2(available - spent);
  const ratio = available > 0 ? remaining / available : 0;
  const budgetSet = state.defaultBudget !== null || typeof state.budgetOverrides[month] === 'number';

  const dim = daysInMonth(month);
  const thisMonth = monthOf(today);
  let daysLeft: number;
  if (month === thisMonth) daysLeft = dim - Number(today.slice(8, 10)) + 1;
  else daysLeft = compareMonths(month, thisMonth) > 0 ? dim : 0;
  const dailySafe = daysLeft > 0 ? Math.max(0, remaining) / daysLeft : null;

  const stats: CategoryStat[] = state.categories.map((c) => categoryStat(c, expenses, available));
  const uncategorized = expenses.filter((e) => e.categoryId === null || !state.categories.some((c) => c.id === e.categoryId));
  if (uncategorized.length > 0) {
    const s = sum(uncategorized);
    stats.push({
      id: null,
      name: 'Uncategorized',
      color: UNCATEGORIZED_COLOR,
      limit: null,
      spent: s,
      count: uncategorized.length,
      shareOfBudget: available > 0 ? s / available : 0,
      limitRatio: null,
    });
  }

  const days = buildDays(month, expenses, state.categories, today);

  // ---- insights
  const elapsed = month === thisMonth ? Number(today.slice(8, 10)) : compareMonths(month, thisMonth) < 0 ? dim : 0;
  const pace = available > 0 ? available / dim : 0;
  const avgPerDay = elapsed > 0 ? spent / elapsed : 0;
  const projected = month === thisMonth ? (elapsed > 0 ? round2(avgPerDay * dim) : 0) : compareMonths(month, thisMonth) < 0 ? spent : null;

  let underPaceStreak = 0;
  for (let i = elapsed - 1; i >= 0; i--) {
    if (days[i].total <= pace + 0.005) underPaceStreak++;
    else break;
  }
  const methods: Record<PaymentMethod, number> = { UPI: 0, Card: 0, Cash: 0 };
  const weekdays = new Array<number>(7).fill(0);
  for (const e of expenses) {
    methods[e.method] = round2(methods[e.method] + e.amount);
    const [y, m, d] = e.date.split('-').map(Number);
    const wd = (new Date(y, m - 1, d).getDay() + 6) % 7;
    weekdays[wd] = round2(weekdays[wd] + e.amount);
  }
  const biggest = expenses.reduce<Expense | null>((b, e) => (!b || e.amount > b.amount ? e : b), null);
  const topCategory = stats.reduce<CategoryStat | null>((b, s) => (s.spent > 0 && (!b || s.spent > b.spent) ? s : b), null);

  const insights: Insights = {
    elapsed,
    avgPerDay,
    projected,
    projectedLeft: projected === null ? null : round2(available - projected),
    pace,
    noSpendDays: days.slice(0, elapsed).filter((d) => d.total === 0).length,
    underPaceStreak,
    biggest,
    topCategory,
    methods,
    weekdays,
    todaySpent: days.find((d) => d.isToday)?.total ?? 0,
  };

  return {
    month,
    budgetSet,
    accent: budgetSet ? healthColor(ratio) : '#64748b',
    status: budgetSet ? healthLabel(ratio, remaining < 0) : 'Set your budget',
    baseBudget,
    carried,
    income,
    incomeEntries,
    available,
    spent,
    remaining,
    ratio,
    over: remaining < 0,
    daysLeft,
    dailySafe,
    stats,
    expenses,
    days,
    insights,
  };
}

function categoryStat(c: Category, monthExpenses: Expense[], available: number): CategoryStat {
  const mine = monthExpenses.filter((e) => e.categoryId === c.id);
  const spent = sum(mine);
  return {
    id: c.id,
    name: c.name,
    color: c.color,
    limit: c.limit,
    spent,
    count: mine.length,
    shareOfBudget: available > 0 ? spent / available : 0,
    limitRatio: c.limit && c.limit > 0 ? spent / c.limit : null,
  };
}
