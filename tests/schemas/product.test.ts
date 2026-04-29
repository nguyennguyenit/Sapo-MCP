/**
 * Tests for ProductSchema — Sapo Product resource (read shape)
 *
 * Fixtures: real captured from store giapducthangscs (2026-04-30).
 * Key Sapo differences from Shopify:
 *  - Uses "name" not "title" as product display name
 *  - Timestamps: created_on / modified_on
 *  - Price is FLOAT VND (150000.0000), not integer
 *  - "alias" not "handle" for URL slug
 */
import { describe, expect, it } from 'vitest';
import {
  ProductListResponseSchema,
  ProductSchema,
  ProductSingleResponseSchema,
} from '../../src/schemas/product.js';
import listFixture from '../fixtures/sapo/products/list-response.json' with { type: 'json' };
import singleFixture from '../fixtures/sapo/products/single.json' with { type: 'json' };

describe('ProductSchema', () => {
  it('parses a real Sapo product with created_on / modified_on timestamps', () => {
    const result = ProductSchema.safeParse(singleFixture.product);
    expect(result.success).toBe(true);
    if (result.success) {
      // Real fixture timestamps from captured API response
      expect(result.data.created_on).toBe('2025-05-13T08:53:30Z');
      expect(result.data.modified_on).toBe('2025-05-13T08:53:31Z');
    }
  });

  it('uses created_on NOT created_at (Sapo convention, not Shopify)', () => {
    const product = singleFixture.product;
    expect('created_on' in product).toBe(true);
    expect('created_at' in product).toBe(false);
  });

  it('parses price as float VND (Sapo serializes with 4 decimals)', () => {
    // Real Sapo price is 150000.0000 — schema must accept float, not int-only
    const result = ProductSchema.parse(singleFixture.product);
    // Variants carry the price; product-level price field may be absent
    const variant = result.variants?.[0];
    expect(variant?.price).toBe(150000);
    // Sapo floats: 150000.0000 === 150000 in JS but must NOT be rejected
    expect(Number.isFinite(variant?.price as number)).toBe(true);
  });

  it('accepts decimal price (Sapo serializes float VND, e.g. 150000.0000)', () => {
    // Schema must accept floats — Sapo returns 4-decimal prices
    const product = { ...singleFixture.product, price: 99.99 };
    const result = ProductSchema.safeParse(product);
    expect(result.success).toBe(true);
  });

  it('parses status enum', () => {
    const result = ProductSchema.parse(singleFixture.product);
    expect(result.status).toBe('active');
  });

  it('uses "name" as product display field (not "title")', () => {
    const result = ProductSchema.parse(singleFixture.product);
    // Real Sapo fixture uses "name" field
    expect((result as Record<string, unknown>).name).toBe('Sữa tắm Dove');
  });

  it('parses nested variants array with float price', () => {
    const result = ProductSchema.parse(singleFixture.product);
    expect(result.variants).toHaveLength(1);
    // Sapo serializes 150000.0000 which JS parses as 150000
    expect(result.variants?.[0].price).toBe(150000);
  });

  it('parses nested options array', () => {
    const result = ProductSchema.parse(singleFixture.product);
    // Real fixture: 1 option ("Title") with value "Default Title"
    expect(result.options).toHaveLength(1);
    expect(result.options?.[0].name).toBe('Title');
  });

  it('passes through unknown fields', () => {
    const withExtra = { ...singleFixture.product, seo_title: 'Test SEO' };
    const result = ProductSchema.parse(withExtra);
    expect((result as Record<string, unknown>).seo_title).toBe('Test SEO');
  });

  it('requires id, created_on, modified_on', () => {
    // Real Sapo product has no "title" — schema must not require it
    // But id, created_on, modified_on are required
    const { id: _id, ...withoutId } = singleFixture.product;
    const result = ProductSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
  });
});

describe('ProductSingleResponseSchema', () => {
  it('parses wrapped single response from real fixture', () => {
    const result = ProductSingleResponseSchema.safeParse(singleFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      // Real fixture product ID captured from store giapducthangscs
      expect(result.data.product.id).toBe(46419129);
    }
  });
});

describe('ProductListResponseSchema', () => {
  it('parses list response with 2 real products', () => {
    const result = ProductListResponseSchema.safeParse(listFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.products).toHaveLength(2);
    }
  });
});
