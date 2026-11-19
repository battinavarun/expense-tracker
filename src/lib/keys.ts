import type { CategoryStat } from './calc';

/** Stable selection key for a category stat; Uncategorized has no id. */
export const NONE_KEY = '__none__';
export const statKey = (s: Pick<CategoryStat, 'id'>): string => s.id ?? NONE_KEY;
