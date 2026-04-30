/**
 * Tiny TTL cache for expensive shop-level lookups (locations, payment methods,
 * shop info) called repeatedly across analytics reports within a session.
 *
 * Not a general-purpose cache — values are kept indefinitely until expiry.
 */

export interface TtlCache<V> {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  /** Force-evict; mainly for tests. */
  clear(): void;
}

export interface TtlCacheOptions {
  ttlMs: number;
  /** Override clock for tests. */
  now?: () => number;
}

export function createTtlCache<V>(opts: TtlCacheOptions): TtlCache<V> {
  const now = opts.now ?? (() => Date.now());
  const store = new Map<string, { value: V; expiresAt: number }>();

  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt < now()) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      store.set(key, { value, expiresAt: now() + opts.ttlMs });
    },
    clear() {
      store.clear();
    },
  };
}
