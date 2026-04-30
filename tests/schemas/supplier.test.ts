/**
 * Tests for SupplierSchema (UNDOC endpoint, verified 2026-04-30)
 * Fixtures: stub — replace with real capture from `npm run capture:fixtures` before 0.2.0 publish.
 */
import { describe, expect, it } from 'vitest';
import {
  SupplierListResponseSchema,
  SupplierSchema,
  SupplierSingleResponseSchema,
} from '../../src/schemas/supplier.js';
import listFixture from '../fixtures/sapo/suppliers/list.json' with { type: 'json' };
import singleFixture from '../fixtures/sapo/suppliers/single.json' with { type: 'json' };

describe('SupplierSchema', () => {
  it('parses a valid supplier', () => {
    const result = SupplierSchema.safeParse(listFixture.suppliers[0]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(30001);
      expect(result.data.name).toBe('Công ty TNHH ABC');
    }
  });

  it('requires id and name', () => {
    const result = SupplierSchema.safeParse({ phone: '***' });
    expect(result.success).toBe(false);
  });

  it('allows null optional fields', () => {
    const result = SupplierSchema.safeParse({ id: 1, name: 'Test', phone: null, email: null });
    expect(result.success).toBe(true);
  });

  it('passes through unknown fields', () => {
    const result = SupplierSchema.safeParse({ id: 1, name: 'Test', extra: 'value' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).extra).toBe('value');
    }
  });

  it('uses created_on / modified_on (Sapo convention, not _at)', () => {
    const result = SupplierSchema.safeParse({
      id: 1,
      name: 'Test',
      created_on: '2024-01-01T00:00:00Z',
      modified_on: '2024-01-01T00:00:00Z',
    });
    expect(result.success).toBe(true);
  });
});

describe('SupplierSingleResponseSchema', () => {
  it('parses single fixture', () => {
    const result = SupplierSingleResponseSchema.safeParse(singleFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.supplier.id).toBe(30001);
    }
  });

  it('rejects missing supplier wrapper', () => {
    const result = SupplierSingleResponseSchema.safeParse({ id: 1 });
    expect(result.success).toBe(false);
  });
});

describe('SupplierListResponseSchema', () => {
  it('parses list fixture', () => {
    const result = SupplierListResponseSchema.safeParse(listFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.suppliers).toHaveLength(2);
    }
  });

  it('parses empty list', () => {
    const result = SupplierListResponseSchema.safeParse({ suppliers: [] });
    expect(result.success).toBe(true);
  });
});
