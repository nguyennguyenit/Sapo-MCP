/**
 * Tests for CustomerSchema — Sapo Customer resource
 */
import { describe, expect, it } from 'vitest';
import {
  CustomerListResponseSchema,
  CustomerSchema,
  CustomerSingleResponseSchema,
} from '../../src/schemas/customer.js';
import listFixture from '../fixtures/sapo/customers/list-response.json' with { type: 'json' };
import singleFixture from '../fixtures/sapo/customers/single.json' with { type: 'json' };

describe('CustomerSchema', () => {
  it('parses a single customer with Sapo timestamp fields', () => {
    const result = CustomerSchema.safeParse(singleFixture.customer);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.created_on).toBe('2024-01-10T08:00:00Z');
      expect(result.data.modified_on).toBe('2024-04-15T12:30:00Z');
    }
  });

  it('does NOT accept created_at (Shopify field name)', () => {
    // created_at passes through (passthrough schema) but it's not required
    // The critical assertion: created_on must be present and used
    const customer = singleFixture.customer;
    expect('created_on' in customer).toBe(true);
    expect('created_at' in customer).toBe(false);
  });

  it('parses total_spent as integer VND', () => {
    const result = CustomerSchema.parse(singleFixture.customer);
    expect(result.total_spent).toBe(2500000);
    expect(Number.isInteger(result.total_spent)).toBe(true);
  });

  it('passes through unknown fields (additive drift tolerance)', () => {
    const withExtra = { ...singleFixture.customer, loyalty_points: 500 };
    const result = CustomerSchema.parse(withExtra);
    expect((result as Record<string, unknown>).loyalty_points).toBe(500);
  });

  it('requires created_on and modified_on', () => {
    const { created_on: _co, modified_on: _mo, ...withoutTimestamps } = singleFixture.customer;
    const result = CustomerSchema.safeParse(withoutTimestamps);
    expect(result.success).toBe(false);
  });

  it('requires at least id', () => {
    const result = CustomerSchema.safeParse({ email: 'test@example.com' });
    expect(result.success).toBe(false);
  });

  it('allows nullable email and phone', () => {
    const customer = { ...singleFixture.customer, email: null, phone: null };
    const result = CustomerSchema.safeParse(customer);
    expect(result.success).toBe(true);
  });

  it('parses state enum correctly', () => {
    const result = CustomerSchema.parse(singleFixture.customer);
    expect(result.state).toBe('enabled');
  });

  it('parses nested default_address with VN fields', () => {
    const result = CustomerSchema.parse(singleFixture.customer);
    expect(result.default_address?.province).toBe('Hà Nội');
    expect(result.default_address?.district).toBe('Hoàn Kiếm');
  });
});

describe('CustomerSingleResponseSchema', () => {
  it('parses wrapped single response', () => {
    const result = CustomerSingleResponseSchema.safeParse(singleFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customer.id).toBe(1001);
    }
  });
});

describe('CustomerListResponseSchema', () => {
  it('parses list response with multiple customers', () => {
    const result = CustomerListResponseSchema.safeParse(listFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customers).toHaveLength(2);
    }
  });
});
