const inr0 = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const inr2 = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const plain = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** ₹44,280 — shows paise only when they exist. */
export function formatINR(n: number): string {
  const v = Number.isFinite(n) ? round2(n) : 0;
  return Number.isInteger(v) ? inr0.format(v) : inr2.format(v);
}

/** Always whole rupees, for big headline numbers. */
export function formatINRWhole(n: number): string {
  return inr0.format(Number.isFinite(n) ? Math.round(n) : 0);
}

/** ₹250 · ₹9.3k · ₹1.2L — short labels for 3D scenes. */
export function formatCompact(n: number): string {
  const v = Math.abs(Number.isFinite(n) ? n : 0);
  if (v >= 1e7) return `₹${trim(v / 1e7)}Cr`;
  if (v >= 1e5) return `₹${trim(v / 1e5)}L`;
  if (v >= 1e4) return `₹${trim(v / 1e3)}k`;
  if (v >= 1e3) return `₹${trim(v / 1e3)}k`;
  return `₹${Math.round(v)}`;
}
const trim = (x: number) => String(Math.round(x * 10) / 10);

export function formatPlain(n: number): string {
  return plain.format(Number.isFinite(n) ? n : 0);
}

export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return '0%';
  const p = ratio * 100;
  return `${p >= 10 || Number.isInteger(p) ? Math.round(p) : p.toFixed(1)}%`;
}

/**
 * Parses what a human types into an amount box: "1,250", "₹ 80.5", " 40 ".
 * Returns null for anything that isn't a positive, finite, sane number.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, '');
  if (cleaned === '' || !/^\d*\.?\d{0,2}$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0 || n > 1e9) return null;
  return round2(n);
}
