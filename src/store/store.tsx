import { createContext, useContext, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode } from 'react';
import type { AppState, Category, Expense, Income, MonthKey, Recurring, ViewMode } from '../types';
import { dateInMonth } from '../lib/dates';
import { round2 } from '../lib/format';
import { loadState, newId, saveState } from '../lib/storage';

export type Action =
  | { type: 'SET_BUDGET'; amount: number; scope: 'month' | 'all'; month: MonthKey }
  | { type: 'CLEAR_MONTH_BUDGET'; month: MonthKey }
  | { type: 'SET_CARRY'; value: boolean }
  | { type: 'SET_VIEW'; value: ViewMode }
  | { type: 'ADD_CATEGORY'; category: Omit<Category, 'id'> & { id?: string } }
  | { type: 'UPDATE_CATEGORY'; category: Category }
  | { type: 'DELETE_CATEGORY'; id: string }
  | { type: 'ADD_EXPENSE'; expense: Omit<Expense, 'id'> & { id?: string } }
  | { type: 'UPDATE_EXPENSE'; expense: Expense }
  | { type: 'DELETE_EXPENSE'; id: string }
  | { type: 'ADD_INCOME'; income: Omit<Income, 'id'> & { id?: string } }
  | { type: 'DELETE_INCOME'; id: string }
  | { type: 'ADD_RECURRING'; recurring: Omit<Recurring, 'id'> }
  | { type: 'UPDATE_RECURRING'; recurring: Recurring }
  | { type: 'DELETE_RECURRING'; id: string }
  | { type: 'APPLY_RECURRING'; month: MonthKey; ids?: string[] }
  | { type: 'REPLACE_ALL'; state: AppState };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_BUDGET': {
      const amount = round2(action.amount);
      if (!(amount > 0)) return state;
      if (action.scope === 'all') {
        // "All months" also drops overrides so the new figure really applies everywhere.
        return { ...state, defaultBudget: amount, budgetOverrides: {} };
      }
      return { ...state, budgetOverrides: { ...state.budgetOverrides, [action.month]: amount } };
    }
    case 'CLEAR_MONTH_BUDGET': {
      const { [action.month]: _removed, ...rest } = state.budgetOverrides;
      return { ...state, budgetOverrides: rest };
    }
    case 'SET_CARRY':
      return { ...state, carryForward: action.value };
    case 'SET_VIEW':
      return { ...state, viewMode: action.value };

    case 'ADD_CATEGORY':
      return { ...state, categories: [...state.categories, { ...action.category, id: action.category.id ?? newId() }] };
    case 'UPDATE_CATEGORY':
      return { ...state, categories: state.categories.map((c) => (c.id === action.category.id ? action.category : c)) };
    case 'DELETE_CATEGORY':
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.id),
        // Expenses are kept — they simply become Uncategorized.
        expenses: state.expenses.map((e) => (e.categoryId === action.id ? { ...e, categoryId: null } : e)),
        recurring: state.recurring.map((r) => (r.categoryId === action.id ? { ...r, categoryId: null } : r)),
      };

    case 'ADD_EXPENSE':
      return { ...state, expenses: [...state.expenses, { ...action.expense, id: action.expense.id ?? newId() }] };
    case 'UPDATE_EXPENSE':
      return { ...state, expenses: state.expenses.map((e) => (e.id === action.expense.id ? action.expense : e)) };
    case 'DELETE_EXPENSE':
      return { ...state, expenses: state.expenses.filter((e) => e.id !== action.id) };

    case 'ADD_INCOME':
      return { ...state, income: [...state.income, { ...action.income, id: action.income.id ?? newId() }] };
    case 'DELETE_INCOME':
      return { ...state, income: state.income.filter((i) => i.id !== action.id) };

    case 'ADD_RECURRING':
      return { ...state, recurring: [...state.recurring, { ...action.recurring, id: newId() }] };
    case 'UPDATE_RECURRING':
      return { ...state, recurring: state.recurring.map((r) => (r.id === action.recurring.id ? action.recurring : r)) };
    case 'DELETE_RECURRING':
      return { ...state, recurring: state.recurring.filter((r) => r.id !== action.id) };

    case 'APPLY_RECURRING': {
      const already = new Set(
        state.expenses.filter((e) => e.recurringId && e.date.startsWith(action.month)).map((e) => e.recurringId),
      );
      const created: Expense[] = state.recurring
        .filter((r) => (!action.ids || action.ids.includes(r.id)) && !already.has(r.id))
        .map((r) => ({
          id: newId(),
          amount: r.amount,
          note: r.note,
          categoryId: r.categoryId,
          method: r.method,
          date: dateInMonth(action.month, r.dayOfMonth),
          recurringId: r.id,
        }));
      return created.length ? { ...state, expenses: [...state.expenses, ...created] } : state;
    }

    case 'REPLACE_ALL':
      return action.state;
    default:
      return state;
  }
}

interface StoreValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  /** False if the last attempt to write localStorage failed. */
  persisted: boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const [persisted, setPersisted] = useState(true);

  useEffect(() => {
    setPersisted(saveState(state));
  }, [state]);

  // Keep several open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'rupee-vault:v1' && e.newValue) {
        try {
          // Re-sanitise through loadState so a hand-edited value can't break us.
          dispatch({ type: 'REPLACE_ALL', state: loadState() });
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo(() => ({ state, dispatch, persisted }), [state, persisted]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
