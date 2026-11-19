// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';
import { StoreProvider } from './store/store';
import { ToastProvider } from './components/Toast';
import { STORAGE_KEY } from './lib/storage';

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

describe('<App /> smoke test', () => {
  it('starts empty at ₹44,280 with onboarding and no forced categories', () => {
    mount();
    expect(screen.getAllByText(/₹44,280/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Get started')).toBeTruthy();
    expect(screen.getByText('No categories yet')).toBeTruthy();
  });

  it('logs an expense in a few keystrokes and updates balance + persists', async () => {
    mount();
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
    mount();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: 'abc' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Log an expense' }));
    expect(screen.getByRole('alert').textContent).toMatch(/amount/i);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{"expenses":[]}').expenses).toHaveLength(0);
  });

  it('switches between 3D and Clean Compact view', async () => {
    mount();
    fireEvent.click(screen.getByRole('radio', { name: /Compact/ }));
    expect(screen.queryByTestId('pillars-3d')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: /3D/ }));
    expect(await screen.findByTestId('pillars-3d')).toBeTruthy();
  });

  it('money-in raises the balance, and reconcile finds missing rupees', () => {
    mount();
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
    mount();
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
