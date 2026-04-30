/**
 * Tests for PaymentMethodSchema (UNDOC endpoint, verified 2026-04-30)
 */
import { describe, expect, it } from 'vitest';
import {
  PaymentMethodListResponseSchema,
  PaymentMethodSchema,
} from '../../src/schemas/payment-method.js';
import listFixture from '../fixtures/sapo/payment-methods/list.json' with { type: 'json' };

describe('PaymentMethodSchema', () => {
  it('parses a valid payment method', () => {
    const result = PaymentMethodSchema.safeParse(listFixture.payment_methods[0]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(20001);
      expect(result.data.name).toBe('Tiền mặt');
    }
  });

  it('requires id and name', () => {
    const result = PaymentMethodSchema.safeParse({ code: 'cash' });
    expect(result.success).toBe(false);
  });

  it('allows optional code and active fields', () => {
    const result = PaymentMethodSchema.safeParse({ id: 1, name: 'Test' });
    expect(result.success).toBe(true);
  });

  it('passes through unknown fields', () => {
    const result = PaymentMethodSchema.safeParse({
      id: 1,
      name: 'Test',
      extra_field: 'value',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).extra_field).toBe('value');
    }
  });
});

describe('PaymentMethodListResponseSchema', () => {
  it('parses list fixture', () => {
    const result = PaymentMethodListResponseSchema.safeParse(listFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.payment_methods).toHaveLength(3);
    }
  });

  it('parses empty list', () => {
    const result = PaymentMethodListResponseSchema.safeParse({ payment_methods: [] });
    expect(result.success).toBe(true);
  });

  it('rejects missing payment_methods wrapper', () => {
    const result = PaymentMethodListResponseSchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
  });
});
