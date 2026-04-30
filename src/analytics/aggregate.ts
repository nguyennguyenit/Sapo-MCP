/**
 * Generic aggregation helpers for analytics reports.
 *
 * All amount math uses native number; Sapo emits float VND but we treat
 * sums as float. Callers that need integer VND should `Math.round` at the
 * report boundary, not here.
 */

/** Group items by a key extractor. Order of insertion preserved. */
export function groupBy<T, K extends string | number>(
  items: readonly T[],
  keyOf: (item: T) => K,
): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const k = keyOf(item);
    const bucket = out.get(k);
    if (bucket) bucket.push(item);
    else out.set(k, [item]);
  }
  return out;
}

/** Sum a numeric projection over an array. Treats undefined/null/NaN as 0. */
export function sumBy<T>(
  items: readonly T[],
  pick: (item: T) => number | undefined | null,
): number {
  let total = 0;
  for (const item of items) {
    const v = pick(item);
    if (typeof v === 'number' && Number.isFinite(v)) total += v;
  }
  return total;
}

/** Sort descending and take the top N entries by score. */
export function topN<T>(items: readonly T[], scoreOf: (item: T) => number, n: number): T[] {
  if (n <= 0) return [];
  return [...items].sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, n);
}

/**
 * Coarse period bucket for an ISO date string.
 *   day   → "2026-04-30"
 *   week  → ISO-week "2026-W18"
 *   month → "2026-04"
 *
 * Returns 'invalid' when the input cannot be parsed; callers may filter.
 */
export type PeriodGranularity = 'day' | 'week' | 'month';

export function periodKey(iso: string, granularity: PeriodGranularity): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'invalid';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  if (granularity === 'day') return `${y}-${m}-${day}`;
  if (granularity === 'month') return `${y}-${m}`;
  // ISO week (Mon-based)
  const tmp = new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Inclusive ISO-date range filter. Both bounds optional.
 * Compares lexicographic ISO substrings — safe because ISO 8601 sorts as strings.
 */
export function inDateRange(iso: string | undefined | null, from?: string, to?: string): boolean {
  if (!iso) return false;
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}
