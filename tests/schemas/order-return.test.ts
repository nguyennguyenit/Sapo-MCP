/**
 * Tests for OrderReturnSchema.
 * Note: Live fixture has empty array — schema tested with synthetic data
 * matching Sapo conventions (created_on, float amounts).
 */
import { describe, expect, it } from 'vitest';
import {
  OrderReturnListResponseSchema,
  OrderReturnSchema,
  OrderReturnSingleResponseSchema,
} from '../../src/schemas/order-return.js';
import listFixture from '../fixtures/sapo/order-returns/list-response.json' with { type: 'json' };

const syntheticReturn = {
  id: 9900001,
  order_id: 174107276,
  status: 'pending',
  note: 'Customer requested return',
  created_on: '2026-04-30T10:00:00Z',
  modified_on: '2026-04-30T10:00:00Z',
  line_items: [
    {
      line_item_id: 290320676,
      quantity: 1,
      restock_type: 'return',
    },
  ],
  restock: true,
  refund_amount: 150000.0,
};

describe('OrderReturnSchema', () => {
  it('parses real list fixture (empty array) successfully', () => {
    const result = OrderReturnListResponseSchema.safeParse(listFixture);
    expect(result.success).toBe(true);
    if (!result.success) console.error(result.error.format());
  });

  it('returns empty array for list fixture', () => {
    const result = OrderReturnListResponseSchema.safeParse(listFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.order_returns).toHaveLength(0);
    }
  });

  it('parses synthetic return successfully', () => {
    const result = OrderReturnSchema.safeParse(syntheticReturn);
    expect(result.success).toBe(true);
    if (!result.success) console.error(result.error.format());
  });

  it('accepts status "pending" (from synthetic)', () => {
    const result = OrderReturnSchema.safeParse(syntheticReturn);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('pending');
    }
  });

  it('accepts status "approved"', () => {
    const result = OrderReturnSchema.safeParse({ ...syntheticReturn, status: 'approved' });
    expect(result.success).toBe(true);
  });

  it('accepts status "refunded"', () => {
    const result = OrderReturnSchema.safeParse({ ...syntheticReturn, status: 'refunded' });
    expect(result.success).toBe(true);
  });

  it('accepts status "cancelled"', () => {
    const result = OrderReturnSchema.safeParse({ ...syntheticReturn, status: 'cancelled' });
    expect(result.success).toBe(true);
  });

  it('uses created_on / modified_on (NOT _at)', () => {
    const result = OrderReturnSchema.safeParse(syntheticReturn);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.created_on).toBe('2026-04-30T10:00:00Z');
      expect(result.data.modified_on).toBe('2026-04-30T10:00:00Z');
    }
  });

  it('accepts float refund_amount (VND as float)', () => {
    const result = OrderReturnSchema.safeParse(syntheticReturn);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.refund_amount).toBe(150000.0);
    }
  });

  it('passes through unknown fields', () => {
    const ret = { ...syntheticReturn, future_field: 'drift' };
    const result = OrderReturnSchema.safeParse(ret);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).future_field).toBe('drift');
    }
  });

  it('requires id', () => {
    const { id: _id, ...withoutId } = syntheticReturn;
    const result = OrderReturnSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
  });

  it('requires order_id', () => {
    const { order_id: _oid, ...withoutOrderId } = syntheticReturn;
    const result = OrderReturnSchema.safeParse(withoutOrderId);
    expect(result.success).toBe(false);
  });

  it('requires created_on', () => {
    const { created_on: _c, ...withoutCreated } = syntheticReturn;
    const result = OrderReturnSchema.safeParse(withoutCreated);
    expect(result.success).toBe(false);
  });

  it('parses single response wrapper', () => {
    const result = OrderReturnSingleResponseSchema.safeParse({ order_return: syntheticReturn });
    expect(result.success).toBe(true);
  });

  it('parses list response wrapper with items', () => {
    const result = OrderReturnListResponseSchema.safeParse({ order_returns: [syntheticReturn] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.order_returns).toHaveLength(1);
    }
  });
});
