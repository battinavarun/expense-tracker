export type PaymentMethod = 'UPI' | 'Card' | 'Cash';
export const PAYMENT_METHODS: PaymentMethod[] = ['UPI', 'Card', 'Cash'];

/** 'YYYY-MM' */
export type MonthKey = string;
/** 'YYYY-MM-DD' */
export type DateKey = string;

export interface Category {
  id: string;
  name: string;
  /** '#rrggbb' */
  color: string;
  /** Optional spending limit in rupees. null/undefined = just track. */
  limit: number | null;
}

export interface Expense {
  id: string;
  amount: number;
  note: string;
  /** null = Uncategorized */
  categoryId: string | null;
  method: PaymentMethod;
  date: DateKey;
  /** Set when this expense was created from a recurring template. */
  recurringId?: string;
}

export interface Recurring {
  id: string;
  amount: number;
  note: string;
  categoryId: string | null;
  method: PaymentMethod;
  /** 1–31; clamped to the month length when applied. */
  dayOfMonth: number;
}

/** Money coming in this month (side income, refunds, top-ups). Adds to the spendable pool. */
export interface Income {
  id: string;
  amount: number;
  note: string;
  date: DateKey;
}

export type ViewMode = 'interactive' | 'compact';

export interface AppState {
  version: 1;
  /** Budget used for every month without an override. */
  defaultBudget: number;
  /** Per-month budget overrides. */
  budgetOverrides: Record<MonthKey, number>;
  /** When true, positive leftover from the previous month is added to the next month. */
  carryForward: boolean;
  viewMode: ViewMode;
  categories: Category[];
  expenses: Expense[];
  income: Income[];
  recurring: Recurring[];
}

export const DEFAULT_BUDGET = 44280;
