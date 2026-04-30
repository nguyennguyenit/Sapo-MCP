import { describe, expect, it } from 'vitest';
import { createTtlCache } from '../../src/analytics/cache.js';

describe('createTtlCache', () => {
  it('returns undefined for missing key', () => {
    const c = createTtlCache<number>({ ttlMs: 1000, now: () => 0 });
    expect(c.get('x')).toBeUndefined();
  });

  it('returns set value within TTL', () => {
    let t = 0;
    const c = createTtlCache<string>({ ttlMs: 1000, now: () => t });
    c.set('k', 'v');
    t = 500;
    expect(c.get('k')).toBe('v');
  });

  it('expires value after TTL', () => {
    let t = 0;
    const c = createTtlCache<string>({ ttlMs: 1000, now: () => t });
    c.set('k', 'v');
    t = 2000;
    expect(c.get('k')).toBeUndefined();
  });

  it('clear() empties the cache', () => {
    const c = createTtlCache<number>({ ttlMs: 1000, now: () => 0 });
    c.set('a', 1);
    c.set('b', 2);
    c.clear();
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBeUndefined();
  });
});
