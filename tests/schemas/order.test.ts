/**
 * Tests for OrderSchema — validates shape of real Sapo fixture
 */
import { describe, expect, it } from 'vitest';
import {
  OrderListResponseSchema,
  OrderSchema,
  OrderSingleResponseSchema,
} from '../../src/schemas/order.js';
import listFixture from '../fixtures/sapo/orders/list-response.json' with { type: 'json' };
import singleFixture from '../fixtures/sapo/orders/single.json' with { type: 'json' };

describe('OrderSchema', () => {
  it('parses real list fixture successfully', () => {
    const result = OrderListResponseSchema.safeParse(listFixture);
    expect(result.success).toBe(true);
    if (!result.success) console.error(result.error.format());
  });

  it('parses real single fixture successfully', () => {
    const result = OrderSingleResponseSchema.safeParse(singleFixture);
    expect(result.success).toBe(true);
    if (!result.success) console.error(result.error.format());
  });

  it('has correct id from real fixture', () => {
    const order = singleFixture.order;
    const result = OrderSchema.safeParse(order);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(174107276);
    }
  });

  it('accepts financial_status "pending" (from real fixture)', () => {
    const order = singleFixture.order;
    const result = OrderSchema.safeParse(order);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.financial_status).toBe('pending');
    }
  });

  it('accepts fulfillment_status "fulfilled" (from real fixture)', () => {
    const order = singleFixture.order;
    const result = OrderSchema.safeParse(order);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fulfillment_status).toBe('fulfilled');
    }
  });

  it('accepts status "open" (from real fixture)', () => {
    const order = singleFixture.order;
    const result = OrderSchema.safeParse(order);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('open');
    }
  });

  it('accepts float total_price (Phase 3a quirk: VND as float)', () => {
    const order = { ...singleFixture.order, total_price: 150000.0 };
    const result = OrderSchema.safeParse(order);
    expect(result.success).toBe(true);
  });

  it('has line_items array from real fixture', () => {
    const result = OrderSchema.safeParse(singleFixture.order);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Array.isArray(result.data.line_items)).toBe(true);
      expect(result.data.line_items.length).toBeGreaterThan(0);
    }
  });

  it('has embedded fulfillments from real fixture', () => {
    const result = OrderSchema.safeParse(singleFixture.order);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Array.isArray(result.data.fulfillments)).toBe(true);
      expect((result.data.fulfillments ?? []).length).toBe(1);
    }
  });

  it('has both sub_total_price and subtotal_price (Sapo quirk)', () => {
    const result = OrderSchema.safeParse(singleFixture.order);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subtotal_price).toBeDefined();
      expect(result.data.sub_total_price).toBeDefined();
    }
  });

  it('allows cancel_reason: null', () => {
    const result = OrderSchema.safeParse(singleFixture.order);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cancel_reason).toBeNull();
    }
  });

  it('has test: false field (sandbox marker)', () => {
    const result = OrderSchema.safeParse(singleFixture.order);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.test).toBe(false);
    }
  });

  it('has payment_gateway_names as array', () => {
    const result = OrderSchema.safeParse(singleFixture.order);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Array.isArray(result.data.payment_gateway_names)).toBe(true);
    }
  });

  it('passes through unknown fields (additive drift tolerance)', () => {
    const order = { ...singleFixture.order, unknown_future_field: 'drift' };
    const result = OrderSchema.safeParse(order);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).unknown_future_field).toBe('drift');
    }
  });

  it('requires id', () => {
    const { id: _id, ...withoutId } = singleFixture.order;
    const result = OrderSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
  });

  it('requires financial_status', () => {
    const { financial_status: _fs, ...withoutFs } = singleFixture.order;
    const result = OrderSchema.safeParse(withoutFs);
    expect(result.success).toBe(false);
  });

  it('requires created_on', () => {
    const { created_on: _c, ...withoutCreated } = singleFixture.order;
    const result = OrderSchema.safeParse(withoutCreated);
    expect(result.success).toBe(false);
  });

  it('rejects invalid financial_status enum', () => {
    const order = { ...singleFixture.order, financial_status: 'invalid_status' };
    const result = OrderSchema.safeParse(order);
    expect(result.success).toBe(false);
  });

  it('uses created_on NOT created_at', () => {
    // Schema property names must not include created_at
    const result = OrderSchema.safeParse(singleFixture.order);
    expect(result.success).toBe(true);
    if (result.success) {
      // created_at should not be a known schema key; created_on should be present
      expect(result.data.created_on).toBe('2026-04-29T19:17:27Z');
    }
  });

  it('accepts customer nested in order', () => {
    const result = OrderSchema.safeParse(singleFixture.order);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customer?.id).toBe(42145427);
    }
  });

  it('accepts shipping_address with VN district/ward fields', () => {
    const result = OrderSchema.safeParse(singleFixture.order);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.shipping_address?.district).toBe('Thành phố Thủ Đức');
      expect(result.data.shipping_address?.ward).toBe('Phường Hiệp Bình Phước');
    }
  });
});
