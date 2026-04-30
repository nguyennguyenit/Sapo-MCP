import { describe, expect, it } from 'vitest';
import { groupBy, inDateRange, periodKey, sumBy, topN } from '../../src/analytics/aggregate.js';

describe('groupBy', () => {
  it('groups items by key, preserving insertion order', () => {
    const items = [
      { k: 'a', v: 1 },
      { k: 'b', v: 2 },
      { k: 'a', v: 3 },
    ];
    const groups = groupBy(items, (i) => i.k);
    expect([...groups.keys()]).toEqual(['a', 'b']);
    expect(groups.get('a')).toHaveLength(2);
    expect(groups.get('b')).toHaveLength(1);
  });

  it('returns empty map for empty input', () => {
    expect(groupBy([] as { k: string }[], (i) => i.k).size).toBe(0);
  });
});

describe('sumBy', () => {
  it('sums a numeric projection', () => {
    expect(sumBy([{ x: 1 }, { x: 2 }, { x: 3 }], (i) => i.x)).toBe(6);
  });

  it('treats null/undefined/NaN as zero', () => {
    expect(
      sumBy(
        [{ x: 1 }, { x: null as unknown as number }, { x: undefined }, { x: Number.NaN }, { x: 4 }],
        (i) => i.x,
      ),
    ).toBe(5);
  });

  it('returns 0 for empty array', () => {
    expect(sumBy([] as { x: number }[], (i) => i.x)).toBe(0);
  });
});

describe('topN', () => {
  it('returns top N descending by score', () => {
    const items = [
      { id: 1, score: 10 },
      { id: 2, score: 50 },
      { id: 3, score: 20 },
    ];
    expect(topN(items, (i) => i.score, 2).map((i) => i.id)).toEqual([2, 3]);
  });

  it('returns [] when n <= 0', () => {
    expect(topN([{ s: 1 }], (i) => i.s, 0)).toEqual([]);
    expect(topN([{ s: 1 }], (i) => i.s, -5)).toEqual([]);
  });

  it('does not mutate input', () => {
    const items = [{ s: 1 }, { s: 2 }];
    topN(items, (i) => i.s, 2);
    expect(items.map((i) => i.s)).toEqual([1, 2]);
  });
});

describe('periodKey', () => {
  it('produces day key', () => {
    expect(periodKey('2026-04-30T10:00:00Z', 'day')).toBe('2026-04-30');
  });

  it('produces month key', () => {
    expect(periodKey('2026-04-30T10:00:00Z', 'month')).toBe('2026-04');
  });

  it('produces ISO week key', () => {
    // 2026-04-30 is a Thursday; ISO week 18
    expect(periodKey('2026-04-30T10:00:00Z', 'week')).toBe('2026-W18');
  });

  it('returns "invalid" for unparseable input', () => {
    expect(periodKey('not-a-date', 'day')).toBe('invalid');
  });
});

describe('inDateRange', () => {
  it('returns true when within bounds', () => {
    expect(inDateRange('2026-04-15', '2026-04-01', '2026-04-30')).toBe(true);
  });

  it('returns false when before from', () => {
    expect(inDateRange('2026-03-31', '2026-04-01', '2026-04-30')).toBe(false);
  });

  it('returns false when after to', () => {
    expect(inDateRange('2026-05-01', '2026-04-01', '2026-04-30')).toBe(false);
  });

  it('treats both bounds as optional', () => {
    expect(inDateRange('2026-04-15')).toBe(true);
    expect(inDateRange('2026-04-15', '2026-04-01')).toBe(true);
    expect(inDateRange('2026-04-15', undefined, '2026-04-30')).toBe(true);
  });

  it('returns false for empty/null input', () => {
    expect(inDateRange(undefined)).toBe(false);
    expect(inDateRange(null)).toBe(false);
  });
});
