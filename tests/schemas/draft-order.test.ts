/**
 * Tests for DraftOrderSchema — validates shape of real Sapo fixture
 */
import { describe, expect, it } from 'vitest';
import {
  DraftOrderListResponseSchema,
  DraftOrderSchema,
  DraftOrderSingleResponseSchema,
  DraftOrderStatusEnum,
} from '../../src/schemas/draft-order.js';
import singleFixture from '../fixtures/sapo/draft-orders/single.json' with { type: 'json' };

const listFixture = { draft_orders: [singleFixture.draft_order] };

describe('DraftOrderSchema', () => {
  it('parses real single fixture successfully', () => {
    const result = DraftOrderSingleResponseSchema.safeParse(singleFixture);
    expect(result.success).toBe(true);
    if (!result.success) console.error(result.error.format());
  });

  it('parses synthetic list fixture successfully', () => {
    const result = DraftOrderListResponseSchema.safeParse(listFixture);
    expect(result.success).toBe(true);
  });

  it('extracts correct id from real fixture', () => {
    const result = DraftOrderSchema.safeParse(singleFixture.draft_order);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.id).toBe(6586400);
  });

  it('extracts status "open" from real fixture', () => {
    const result = DraftOrderSchema.safeParse(singleFixture.draft_order);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe('open');
  });

  it('extracts currency "VND" from real fixture', () => {
    const result = DraftOrderSchema.safeParse(singleFixture.draft_order);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.currency).toBe('VND');
  });

  it('extracts total_price from real fixture', () => {
    const result = DraftOrderSchema.safeParse(singleFixture.draft_order);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.total_price).toBe(150000.0);
  });

  it('has line_items array with one item from real fixture', () => {
    const result = DraftOrderSchema.safeParse(singleFixture.draft_order);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.line_items).toHaveLength(1);
      expect(result.data.line_items[0].price).toBe(150000);
    }
  });

  it('accepts null billing_address and shipping_address from real fixture', () => {
    const result = DraftOrderSchema.safeParse(singleFixture.draft_order);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.billing_address).toBeNull();
      expect(result.data.shipping_address).toBeNull();
    }
  });

  it('accepts null customer from real fixture', () => {
    const result = DraftOrderSchema.safeParse(singleFixture.draft_order);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.customer).toBeNull();
  });

  it('accepts created_on / modified_on timestamps', () => {
    const result = DraftOrderSchema.safeParse(singleFixture.draft_order);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.created_on).toBe('2026-04-29T19:06:59Z');
      expect(result.data.modified_on).toBe('2026-04-29T19:06:59Z');
    }
  });

  it('accepts all DraftOrderStatusEnum values', () => {
    for (const status of ['open', 'completed', 'invoice_sent', 'cancelled']) {
      const result = DraftOrderStatusEnum.safeParse(status);
      expect(result.success).toBe(true);
    }
  });

  it('rejects missing required id field', () => {
    const bad = { ...singleFixture.draft_order, id: undefined };
    const result = DraftOrderSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects missing required line_items field', () => {
    const bad = { ...singleFixture.draft_order, line_items: undefined };
    const result = DraftOrderSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('passes through VN-specific fields via passthrough', () => {
    const result = DraftOrderSchema.safeParse(singleFixture.draft_order);
    expect(result.success).toBe(true);
    if (result.success) {
      // VN-specific fields from fixture
      expect(result.data.shipment_category).toBeNull();
      expect(result.data.expected_delivery_date).toBeNull();
    }
  });
});
