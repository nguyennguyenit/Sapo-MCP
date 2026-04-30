/**
 * Tests for CollectSchema — product ↔ collection mapping.
 *
 * Sapo conventions tested:
 * - Timestamps: created_on / modified_on
 * - .passthrough() — unknown fields preserved
 */
import { describe, expect, it } from 'vitest';
import {
  CollectListResponseSchema,
  CollectSchema,
  CollectSingleResponseSchema,
} from '../../src/schemas/collect.js';

const baseCollect = {
  id: 300001,
  collection_id: 100001,
  product_id: 46419129,
  position: 1,
  created_on: '2026-03-01T07:00:00Z',
  modified_on: '2026-03-15T10:30:00Z',
};

describe('CollectSchema', () => {
  it('parses a valid collect mapping', () => {
    const result = CollectSchema.safeParse(baseCollect);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(300001);
      expect(result.data.collection_id).toBe(100001);
      expect(result.data.product_id).toBe(46419129);
    }
  });

  it('uses created_on NOT created_at (Sapo convention)', () => {
    const result = CollectSchema.safeParse(baseCollect);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.created_on).toBe('2026-03-01T07:00:00Z');
      expect(result.data.modified_on).toBe('2026-03-15T10:30:00Z');
      expect((result.data as Record<string, unknown>).created_at).toBeUndefined();
    }
  });

  it('requires id, collection_id, product_id, created_on, modified_on', () => {
    const { id: _id, ...without } = baseCollect;
    expect(CollectSchema.safeParse(without).success).toBe(false);
  });

  it('requires collection_id', () => {
    const { collection_id: _cid, ...without } = baseCollect;
    expect(CollectSchema.safeParse(without).success).toBe(false);
  });

  it('requires product_id', () => {
    const { product_id: _pid, ...without } = baseCollect;
    expect(CollectSchema.safeParse(without).success).toBe(false);
  });

  it('accepts nullable sort_value', () => {
    const withNull = { ...baseCollect, sort_value: null };
    const result = CollectSchema.safeParse(withNull);
    expect(result.success).toBe(true);
  });

  it('accepts optional position', () => {
    const { position: _pos, ...withoutPosition } = baseCollect;
    const result = CollectSchema.safeParse(withoutPosition);
    expect(result.success).toBe(true);
  });

  it('passes through unknown fields', () => {
    const withExtra = { ...baseCollect, featured: true };
    const result = CollectSchema.parse(withExtra);
    expect((result as Record<string, unknown>).featured).toBe(true);
  });
});

describe('CollectSingleResponseSchema', () => {
  it('parses wrapped single response', () => {
    const result = CollectSingleResponseSchema.safeParse({ collect: baseCollect });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.collect.id).toBe(300001);
    }
  });
});

describe('CollectListResponseSchema', () => {
  it('parses list response', () => {
    const result = CollectListResponseSchema.safeParse({ collects: [baseCollect] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.collects).toHaveLength(1);
    }
  });

  it('parses empty list', () => {
    const result = CollectListResponseSchema.safeParse({ collects: [] });
    expect(result.success).toBe(true);
  });
});
