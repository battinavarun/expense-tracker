// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';
import { StoreProvider } from './store/store';
import { ToastProvider } from './components/Toast';
import { STORAGE_KEY } from './lib/storage';
import { todayKey } from './lib/dates';

// The WebGL scene needs a real GPU; the app lazy-loads it, so stub it for jsdom.
vi.mock('./components/Scene3D', () => ({ default: () => <div data-testid="pillars-3d" /> }));
vi.mock('./components/HeroCoins', () => ({ default: () => <div data-testid="hero-coins" /> }));

beforeAll(() => {
  // Newer Node versions ship their own (unusable) global localStorage that shadows jsdom's.
  const mem = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
  });
  // jsdom lacks these browser APIs.
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as never;
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  };
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const mount = () =>
  render(
    <StoreProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </StoreProvider>,
  );

/** Mounts the app and answers the first-run "what's your monthly budget?" question. */
const mountReady = (budget = '44,280') => {
  const utils = mount();
  fireEvent.change(screen.getByLabelText('Monthly budget'), { target: { value: budget } });
  fireEvent.click(screen.getByRole('button', { name: /Start tracking/ }));
  return utils;
};

describe('first run: everything starts at ₹0 and asks for your budget', () => {
  it('opens a blank budget prompt over a dashboard that reads ₹0', () => {
    mount();
    const input = screen.getByLabelText('Monthly budget') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input.placeholder).toBe('0');
    expect(screen.queryByText(/44,280/)).toBeNull();
    // the dashboard behind it exists, with every headline number at zero
    expect(screen.getByLabelText('Remaining balance ₹0')).toBeTruthy();
    expect(screen.getByText('Set your budget')).toBeTruthy(); // card status
    expect(screen.getByLabelText('Log an expense')).toBeTruthy();
  });

  it('rejects empty / zero / junk budgets and stays at ₹0', () => {
    mount();
    for (const bad of ['', '0', 'abc', '-5']) {
      fireEvent.change(screen.getByLabelText('Monthly budget'), { target: { value: bad } });
      fireEvent.click(screen.getByRole('button', { name: /Start tracking/ }));
      expect(screen.getByRole('alert').textContent).toMatch(/greater than ₹0/);
    }
    expect(screen.getByLabelText('Remaining balance ₹0')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').defaultBudget).toBeNull();
  });

  it('uses whatever amount the user enters, and remembers it', () => {
    mountReady('30,000');
    expect(screen.getByLabelText(/Remaining balance ₹30,000/)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').defaultBudget).toBe(30000);
    // reload: no prompt again
    cleanup();
    mount();
    expect(screen.queryByLabelText('Monthly budget')).toBeNull();
    expect(screen.getByLabelText(/Remaining balance ₹30,000/)).toBeTruthy();
  });

  it('"Skip" keeps everything at ₹0, and logging an expense asks for the budget instead of saving', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Skip for now/ }));
    expect(screen.getByLabelText('Remaining balance ₹0')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '250' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Log an expense' }));
    expect(screen.getByLabelText('Monthly budget')).toBeTruthy(); // prompt is back
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{"expenses":[]}').expenses).toHaveLength(0);
    // what was typed is kept, so nothing is lost
    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('250');
  });

  it('discards a budget saved by an older version — even when categories/expenses exist — but keeps the data', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        defaultBudget: 44280,
        budgetOverrides: { [todayKey().slice(0, 7)]: 50000 },
        categories: [{ id: 'c1', name: 'Food', color: '#38bdf8', limit: null }],
        expenses: [{ id: 'x', amount: 10, note: 'Tea', categoryId: 'c1', method: 'UPI', date: todayKey() }],
      }),
    );
    mount();
    expect(screen.getByLabelText('Monthly budget')).toBeTruthy(); // asks again
    expect(screen.queryByText(/44,280|50,000/)).toBeNull(); // no trace of the old number
    expect(within(screen.getByLabelText('Categories')).getByText('Food')).toBeTruthy(); // data kept
    expect(within(screen.getByLabelText('Expenses this month')).getByText('Tea')).toBeTruthy();
  });

  it('keeps a budget the user chose in this version', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, defaultBudget: 12345 }));
    mount();
    expect(screen.queryByLabelText('Monthly budget')).toBeNull();
    expect(screen.getByLabelText(/Remaining balance ₹12,345/)).toBeTruthy();
  });
});

describe('<App /> smoke test', () => {
  it('starts empty with onboarding and no forced categories', () => {
    mountReady();
    expect(screen.getByLabelText('Get started')).toBeTruthy();
    expect(screen.getByText('No categories yet')).toBeTruthy();
  });

  it('logs an expense in a few keystrokes and updates balance + persists', async () => {
    mountReady();
    // add a category from the onboarding ideas
    fireEvent.click(screen.getByRole('button', { name: /^Food$/ }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1,250.50' } });
    fireEvent.change(screen.getByLabelText('What I spent on'), { target: { value: 'Groceries' } });
    fireEvent.click(screen.getByRole('radio', { name: /Food/ }));
    fireEvent.submit(screen.getByRole('form', { name: 'Log an expense' }));

    const list = screen.getByLabelText('Expenses this month');
    expect(within(list).getByText('Groceries')).toBeTruthy();
    expect(screen.getAllByText('₹1,250.50').length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Remaining balance ₹43,029.50/)).toBeTruthy();

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(saved.expenses).toHaveLength(1);
    expect(saved.expenses[0].amount).toBe(1250.5);
    // onboarding disappears once there is data
    expect(screen.queryByLabelText('Get started')).toBeNull();
  });

  it('rejects invalid amounts', () => {
    mountReady();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: 'abc' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Log an expense' }));
    expect(screen.getByRole('alert').textContent).toMatch(/amount/i);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{"expenses":[]}').expenses).toHaveLength(0);
  });

  it('switches between 3D and Clean Compact view', async () => {
    mountReady();
    fireEvent.click(screen.getByRole('radio', { name: /Compact/ }));
    expect(screen.queryByTestId('pillars-3d')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: /3D/ }));
    expect(await screen.findByTestId('pillars-3d')).toBeTruthy();
  });

  it('money-in raises the balance, and reconcile finds missing rupees', () => {
    mountReady();
    fireEvent.click(screen.getByRole('button', { name: /Money in/ }));
    const dlg = screen.getByRole('dialog', { name: 'Money in' });
    fireEvent.change(within(dlg).getByLabelText('Amount (₹)'), { target: { value: '5000' } });
    fireEvent.change(within(dlg).getByLabelText('From'), { target: { value: 'Freelance' } });
    fireEvent.click(within(dlg).getByRole('button', { name: /Add money in/ }));
    expect(screen.getByLabelText(/Remaining balance ₹49,280/)).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Close' }));

    // reconcile: bank shows ₹300 less than expected
    fireEvent.click(screen.getByRole('button', { name: /Reconcile/ }));
    const rec = screen.getByRole('dialog', { name: /Reconcile/ });
    fireEvent.change(within(rec).getByLabelText(/actually have/), { target: { value: '48,980' } });
    expect(within(rec).getByText(/₹300 is missing/)).toBeTruthy();
    fireEvent.click(within(rec).getByRole('button', { name: /Log ₹300 as untracked/ }));
    expect(screen.getByLabelText(/Remaining balance ₹48,980/)).toBeTruthy();
  });

  it('opens category dialog, creates a category with an optional limit, and switches months', () => {
    mountReady();
    fireEvent.click(screen.getByRole('button', { name: /Make my own/ }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Gym' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create category' }));
    expect(within(screen.getByLabelText('Categories')).getByText('Gym')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('Today')).toBeTruthy();
    // a fresh month keeps the full budget
    expect(screen.getByLabelText(/Remaining balance ₹44,280/)).toBeTruthy();
  });
});
