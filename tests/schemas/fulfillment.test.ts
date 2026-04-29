/**
 * Tests for FulfillmentSchema — validates shape of real Sapo fixture
 */
import { describe, expect, it } from 'vitest';
import { FulfillmentListResponseSchema, FulfillmentSchema } from '../../src/schemas/fulfillment.js';
import listFixture from '../fixtures/sapo/fulfillments/list-response.json' with { type: 'json' };

describe('FulfillmentSchema', () => {
  it('parses real list fixture successfully', () => {
    const result = FulfillmentListResponseSchema.safeParse(listFixture);
    expect(result.success).toBe(true);
    if (!result.success) console.error(result.error.format());
  });

  it('has correct id from real fixture', () => {
    const ff = listFixture.fulfillments[0];
    const result = FulfillmentSchema.safeParse(ff);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(132712633);
      expect(result.data.order_id).toBe(174107276);
    }
  });

  it('accepts status "success" (from real fixture)', () => {
    const ff = listFixture.fulfillments[0];
    const result = FulfillmentSchema.safeParse(ff);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('success');
    }
  });

  it('uses created_on / modified_on (Sapo convention)', () => {
    const ff = listFixture.fulfillments[0];
    const result = FulfillmentSchema.safeParse(ff);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.created_on).toBe('2026-04-29T19:17:27Z');
      expect(result.data.modified_on).toBe('2026-04-29T19:17:27Z');
    }
  });

  it('has tracking_company and tracking_number at top level', () => {
    const ff = listFixture.fulfillments[0];
    const result = FulfillmentSchema.safeParse(ff);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tracking_company).toBe('Anh Phương');
      expect(result.data.tracking_number).toBe('#1001');
    }
  });

  it('has line_items array', () => {
    const ff = listFixture.fulfillments[0];
    const result = FulfillmentSchema.safeParse(ff);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Array.isArray(result.data.line_items)).toBe(true);
      expect((result.data.line_items ?? []).length).toBe(1);
    }
  });

  it('has float price in line_items (VND as float)', () => {
    const ff = listFixture.fulfillments[0];
    const result = FulfillmentSchema.safeParse(ff);
    expect(result.success).toBe(true);
    if (result.success) {
      const li = (result.data.line_items ?? [])[0];
      expect(li?.price).toBe(150000.0);
    }
  });

  it('passes through unknown fields', () => {
    const ff = { ...listFixture.fulfillments[0], extra_field: 'drift' };
    const result = FulfillmentSchema.safeParse(ff);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).extra_field).toBe('drift');
    }
  });

  it('requires id', () => {
    const { id: _id, ...withoutId } = listFixture.fulfillments[0];
    const result = FulfillmentSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
  });

  it('requires order_id', () => {
    const { order_id: _oid, ...withoutOrderId } = listFixture.fulfillments[0];
    const result = FulfillmentSchema.safeParse(withoutOrderId);
    expect(result.success).toBe(false);
  });

  it('requires status', () => {
    const { status: _s, ...withoutStatus } = listFixture.fulfillments[0];
    const result = FulfillmentSchema.safeParse(withoutStatus);
    expect(result.success).toBe(false);
  });

  it('requires created_on', () => {
    const { created_on: _c, ...withoutCreated } = listFixture.fulfillments[0];
    const result = FulfillmentSchema.safeParse(withoutCreated);
    expect(result.success).toBe(false);
  });

  it('rejects invalid status enum', () => {
    const ff = { ...listFixture.fulfillments[0], status: 'not_a_status' };
    const result = FulfillmentSchema.safeParse(ff);
    expect(result.success).toBe(false);
  });
});
