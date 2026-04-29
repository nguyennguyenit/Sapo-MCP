/**
 * Unit tests for probe-matrix.
 * Tests: matrix shape, coverage, bucket assignments.
 */
import { describe, expect, it } from 'vitest';

import { PROBE_MATRIX } from '../../scripts/probe-matrix.js';

describe('PROBE_MATRIX', () => {
  it('all entries have bucket property', () => {
    for (const entry of PROBE_MATRIX) {
      expect(entry).toHaveProperty('bucket');
      expect(['A', 'B']).toContain(entry.bucket);
    }
  });

  it('all endpoints start with /admin/', () => {
    for (const entry of PROBE_MATRIX) {
      expect(entry.endpoint).toMatch(/^\/admin\//);
    }
  });

  it('all methods are GET', () => {
    for (const entry of PROBE_MATRIX) {
      expect(entry.method).toBe('GET');
    }
  });

  it('all entries have resource, endpoint, method, bucket', () => {
    for (const entry of PROBE_MATRIX) {
      expect(entry.resource).toBeTruthy();
      expect(entry.endpoint).toBeTruthy();
      expect(entry.method).toBeTruthy();
      expect(entry.bucket).toBeTruthy();
    }
  });

  it('has at least 10 Bucket B entries', () => {
    const bucketB = PROBE_MATRIX.filter((e) => e.bucket === 'B');
    expect(bucketB.length).toBeGreaterThanOrEqual(10);
  });

  it('has at least 12 Bucket A entries', () => {
    const bucketA = PROBE_MATRIX.filter((e) => e.bucket === 'A');
    expect(bucketA.length).toBeGreaterThanOrEqual(12);
  });

  it('Bucket B includes all required POS resources', () => {
    const bucketB = PROBE_MATRIX.filter((e) => e.bucket === 'B');
    const resources = bucketB.map((e) => e.resource);

    const required = [
      'suppliers',
      'purchase_orders',
      'pos_shifts',
      'cash_transactions',
      'stock_transfers',
      'stock_adjustments',
      'purchase_returns',
      'payment_methods',
    ];

    for (const r of required) {
      expect(resources).toContain(r);
    }
  });

  it('Bucket B includes alias endpoints for POS paths', () => {
    const bucketB = PROBE_MATRIX.filter((e) => e.bucket === 'B');
    const endpoints = bucketB.map((e) => e.endpoint);
    // Must have at least one alias attempt (pos/ or payments/)
    const hasAlias = endpoints.some(
      (ep) => ep.includes('/admin/pos/') || ep.includes('/admin/payments/'),
    );
    expect(hasAlias).toBe(true);
  });

  it('store endpoint (Sapo shop info) is critical in Bucket A', () => {
    const store = PROBE_MATRIX.find((e) => e.resource === 'store');
    expect(store).toBeDefined();
    expect(store?.endpoint).toBe('/admin/store.json');
    expect(store?.critical).toBe(true);
    expect(store?.bucket).toBe('A');
  });

  it('has no duplicate endpoints', () => {
    const endpoints = PROBE_MATRIX.map((e) => e.endpoint);
    const unique = new Set(endpoints);
    expect(unique.size).toBe(endpoints.length);
  });
});
