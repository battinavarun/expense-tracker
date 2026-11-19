export const CATEGORY_COLORS = [
  '#38bdf8', // sky
  '#a78bfa', // violet
  '#f472b6', // pink
  '#fb923c', // orange
  '#facc15', // yellow
  '#34d399', // mint
  '#2dd4bf', // teal
  '#818cf8', // indigo
  '#f87171', // red
  '#94a3b8', // slate
];

export const EMERALD = '#10b981';
export const AMBER = '#f59e0b';
export const CORAL = '#ff5d5d';

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

export function mixHex(a: string, b: string, t: number): string {
  const k = Math.min(1, Math.max(0, t));
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  return rgbToHex([ra[0] + (rb[0] - ra[0]) * k, ra[1] + (rb[1] - ra[1]) * k, ra[2] + (rb[2] - ra[2]) * k]);
}

/**
 * Remaining-balance health colour: Emerald → Amber → Coral.
 * `ratio` = remaining / available (can be ≤ 0 when over budget).
 */
export function healthColor(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0.08) return CORAL;
  if (ratio >= 0.55) return EMERALD;
  if (ratio >= 0.25) return mixHex(AMBER, EMERALD, (ratio - 0.25) / 0.3);
  return mixHex(CORAL, AMBER, (ratio - 0.08) / 0.17);
}

export function healthLabel(ratio: number, over: boolean): string {
  if (over) return 'Over budget';
  if (ratio >= 0.55) return 'On track';
  if (ratio >= 0.25) return 'Watch it';
  return 'Running low';
}

export function isHexColor(s: unknown): s is string {
  return typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);
}
