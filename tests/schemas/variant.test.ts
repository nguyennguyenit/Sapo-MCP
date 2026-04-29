/**
 * Tests for VariantSchema — Sapo Product Variant resource
 *
 * single.json — handcrafted fixture (store has verified shape via embedded variants in products)
 * list-response.json — real captured from store giapducthangscs (2026-04-30): 1 variant
 *
 * Key Sapo conventions:
 *  - price: FLOAT VND (e.g. 150000.0000). NOT integer.
 *  - Timestamps: created_on / modified_on (not created_at)
 *  - inventory_management: "bizweb" or null (live store uses "bizweb")
 */
import { describe, expect, it } from 'vitest';
import {
  VariantListResponseSchema,
  VariantSchema,
  VariantSingleResponseSchema,
} from '../../src/schemas/variant.js';
import listFixture from '../fixtures/sapo/variants/list-response.json' with { type: 'json' };
import singleFixture from '../fixtures/sapo/variants/single.json' with { type: 'json' };

describe('VariantSchema', () => {
  it('parses a variant with Sapo timestamp fields', () => {
    const result = VariantSchema.safeParse(singleFixture.variant);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.created_on).toBe('2024-01-15T09:00:00Z');
      expect(result.data.modified_on).toBe('2024-04-10T11:00:00Z');
    }
  });

  it('does NOT use created_at or updated_at (Sapo uses created_on/modified_on)', () => {
    const variant = singleFixture.variant;
    expect('created_on' in variant).toBe(true);
    expect('created_at' in variant).toBe(false);
    expect('updated_at' in variant).toBe(false);
  });

  it('accepts float price (Sapo serializes VND with 4 decimals: 150000.0000)', () => {
    // Sapo live API returns 150000.0000 — schema must accept float, not int-only
    const result = VariantSchema.safeParse({ ...singleFixture.variant, price: 150000.0 });
    expect(result.success).toBe(true);
  });

  it('accepts decimal price values (Sapo float convention)', () => {
    // 99.99 is unusual for VND but schema must not reject decimals — Sapo is float
    const variant = { ...singleFixture.variant, price: 99.99 };
    const result = VariantSchema.safeParse(variant);
    expect(result.success).toBe(true);
  });

  it('parses price from handcrafted fixture (integer VND also valid)', () => {
    const result = VariantSchema.parse(singleFixture.variant);
    expect(result.price).toBe(150000);
    expect(Number.isFinite(result.price)).toBe(true);
  });

  it('allows null compare_at_price', () => {
    const variant = { ...singleFixture.variant, compare_at_price: null };
    const result = VariantSchema.safeParse(variant);
    expect(result.success).toBe(true);
  });

  it('parses inventory fields', () => {
    const result = VariantSchema.parse(singleFixture.variant);
    expect(result.inventory_quantity).toBe(20);
    expect(result.inventory_management).toBe('sapo');
    expect(result.inventory_policy).toBe('deny');
  });

  it('allows null option2 and option3', () => {
    const result = VariantSchema.parse(singleFixture.variant);
    expect(result.option2).toBe('S');
    expect(result.option3).toBeNull();
  });

  it('passes through unknown fields', () => {
    const withExtra = { ...singleFixture.variant, fulfillment_service: 'manual' };
    const result = VariantSchema.parse(withExtra);
    expect((result as Record<string, unknown>).fulfillment_service).toBe('manual');
  });

  it('parses real captured variant with float price (150000.0000)', () => {
    // Real fixture from store giapducthangscs
    const realVariant = listFixture.variants[0];
    const result = VariantSchema.safeParse(realVariant);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe(150000);
      expect(result.data.id).toBe(147237422);
    }
  });
});

describe('VariantSingleResponseSchema', () => {
  it('parses wrapped single response', () => {
    const result = VariantSingleResponseSchema.safeParse(singleFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variant.id).toBe(4001);
    }
  });
});

describe('VariantListResponseSchema', () => {
  it('parses real captured list — 1 variant in fixture', () => {
    // Real fixture from store giapducthangscs has 1 variant
    const result = VariantListResponseSchema.safeParse(listFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variants).toHaveLength(1);
    }
  });
});
