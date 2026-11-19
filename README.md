# Rupee Vault — 3D Monthly Expense Tracker

A tactile, neumorphic expense tracker built around **your own monthly budget**. Everything starts at **₹0**: on first launch a
prompt asks how much you have to spend each month (nothing is pre-filled; you can skip it and stay at ₹0, and change it anytime). No preset 50/30/20 rules: you create your own
categories, optionally give them limits, or just log spending against the pool.

## Features

- **3D titanium salary card** — thick slab edge, tilts with mouse/touch, moving specular highlight, glowing edge that shifts
  Emerald → Amber → Coral with your balance. Gold rupee coins orbit it (more money left = more coins) and **fly off when you log an expense**.
- **Three 3D charts (one WebGL scene, switch with tabs)** — all drag-to-rotate, tap-to-inspect, with floating value labels:
  - **Pillars** — glass tube = 100 % of the month's budget, coloured fill = spent, ring = optional limit (turns red when exceeded).
  - **Ring** — a segmented 3D donut of your whole budget; slices pop out when selected; the glass slice is what's left.
  - **Days** — a bar for every day of the month, stacked by category, with a glowing even-pace line showing overspend days.
- **3D / Clean Compact toggle** — Compact view never loads three.js.
- **Live header** — starting budget, total spent, remaining, daily safe-to-spend, spent today vs today's allowance, month-end forecast.
- **Quick logger** — amount, note, category chips, UPI/Card/Cash, date. Press Enter, done. Undo from the toast.
  One-tap **Repeat** chips for your recent spends, and press **N** anywhere to jump to the amount box.
- **Money in** — log side income, refunds or repayments; they raise your balance and daily safe-to-spend.
- **Reconcile** — type what your bank/UPI actually shows; the app finds the gap and logs it as untracked spending (or extra money in).
- **Insights** — average/day, biggest expense, top category, no-spend days, under-pace streak, weekday habits, payment mix,
  a daily strip, and achievement badges.
- **Custom categories** — create / rename / recolour / delete, limit optional. Deleting keeps expenses as *Uncategorized*.
- **Recurring bills drawer** — save fixed bills once, apply to any month in one click (never duplicated).
- **Month switcher** — each month starts with a fresh budget; optional "carry forward leftover savings".
- **Backup** — auto-saves to `localStorage`; export CSV (month / all) or JSON; import JSON.

## Run locally

Requires Node 18.18+ (tested on Node 26).

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
npm test           # unit + UI smoke tests (Vitest)
```

## Deploy free on Vercel

**Option A — Git (recommended, auto-deploys on every push)**

1. Push this folder to a GitHub repo.
2. Go to <https://vercel.com/new>, import the repo.
3. Vercel detects **Vite** (settings are also pinned in `vercel.json`): build `npm run build`, output `dist`. Click **Deploy**.

**Option B — CLI**

```bash
npm i -g vercel
vercel          # follow the prompts (accept the detected Vite settings)
vercel --prod   # promote to production
```

Your data lives in each visitor's browser (`localStorage`), so there's no backend or environment variables to configure.
Use **Backup → Export JSON** to move data between devices.

## Pinned versions (zero peer-dependency conflicts)

| Package | Version |
| --- | --- |
| react / react-dom | 18.3.1 |
| three / @types/three | 0.169.0 |
| @react-three/fiber | 8.17.10 (React 18 line) |
| @react-three/drei | 9.114.3 (pairs with fiber 8) |
| framer-motion | 11.11.17 |
| tailwindcss | 3.4.14 |
| vite / @vitejs/plugin-react | 5.4.10 / 4.3.3 |

> Don't bump `@react-three/fiber` / `drei` to v9 / v10 without also moving to React 19.

## Folder structure

```
src/
  App.tsx                    page layout + shared UI state
  main.tsx                   providers
  types.ts                   data model
  store/store.tsx            reducer + context + localStorage persistence
  lib/
    calc.ts                  month summary, daily safe-to-spend, carry-forward
    dates.ts  format.ts      local-time date helpers, ₹ en-IN formatting, amount parsing
    storage.ts               load/save, import sanitising, CSV/JSON export
    colors.ts  keys.ts       palette + Emerald→Amber→Coral health colour
  components/
    SalaryCard.tsx           CSS-3D tilting titanium card + coin layer
    HeroCoins.tsx            instanced gold coins (React Three Fiber, lazy-loaded)
    Scene3D.tsx              Pillars / Ring / Days charts (React Three Fiber, lazy-loaded)
    CategoryViz.tsx          chart tabs, 3D vs compact switch, inspectors
    InsightsPanel.tsx        forecast, streaks, weekday + payment charts
    MoneyTools.tsx           Money-in and Reconcile dialogs
    ExpenseLogger.tsx  ExpenseList.tsx  CategoryPanel.tsx  RecurringDrawer.tsx
    StatsRow.tsx  BudgetEditor.tsx  TopBar.tsx  Onboarding.tsx
    Modal.tsx  Toast.tsx  AnimatedNumber.tsx  ErrorBoundary.tsx
```

## Design notes

- The salary card is **CSS 3D**, not WebGL: text stays crisp and typing never competes with a GPU scene.
- The pillar scene pauses when scrolled off-screen, respects *reduced motion*, lets vertical swipes scroll the page on phones,
  and falls back to the compact bars if WebGL is unavailable.
- Imported JSON is validated field-by-field; CSV export neutralises spreadsheet formula injection (`=`, `+`, `-`, `@`).
