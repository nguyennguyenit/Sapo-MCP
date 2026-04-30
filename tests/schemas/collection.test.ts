/**
 * Tests for CustomCollectionSchema and SmartCollectionSchema.
 *
 * Key Sapo conventions tested:
 * - Timestamps: created_on / modified_on (NOT created_at / updated_at)
 * - .passthrough() — unknown fields preserved
 * - sort_order enum values
 */
import { describe, expect, it } from 'vitest';
import {
  CustomCollectionListResponseSchema,
  CustomCollectionSchema,
  CustomCollectionSingleResponseSchema,
  SmartCollectionListResponseSchema,
  SmartCollectionSchema,
  SmartCollectionSingleResponseSchema,
} from '../../src/schemas/collection.js';

const baseCustomCollection = {
  id: 100001,
  title: 'Bộ sưu tập nổi bật',
  alias: 'bo-suu-tap-noi-bat',
  body_html: '<p>Các sản phẩm nổi bật nhất</p>',
  sort_order: 'manual' as const,
  published: true,
  created_on: '2026-01-15T10:00:00Z',
  modified_on: '2026-04-01T08:00:00Z',
};

const baseSmartCollection = {
  id: 200001,
  title: 'Sản phẩm giảm giá',
  alias: 'san-pham-giam-gia',
  body_html: '<p>Tất cả sản phẩm đang giảm giá</p>',
  sort_order: 'best-selling' as const,
  disjunctive: false,
  rules: [{ column: 'tag', relation: 'equals', condition: 'sale' }],
  published: true,
  created_on: '2026-02-01T09:00:00Z',
  modified_on: '2026-04-10T12:00:00Z',
};

describe('CustomCollectionSchema', () => {
  it('parses a minimal custom collection', () => {
    const result = CustomCollectionSchema.safeParse(baseCustomCollection);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(100001);
      expect(result.data.title).toBe('Bộ sưu tập nổi bật');
    }
  });

  it('uses created_on NOT created_at (Sapo convention)', () => {
    const result = CustomCollectionSchema.safeParse(baseCustomCollection);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.created_on).toBe('2026-01-15T10:00:00Z');
      expect(result.data.modified_on).toBe('2026-04-01T08:00:00Z');
      expect((result.data as Record<string, unknown>).created_at).toBeUndefined();
    }
  });

  it('requires id, title, created_on, modified_on', () => {
    const { id: _id, ...without } = baseCustomCollection;
    expect(CustomCollectionSchema.safeParse(without).success).toBe(false);
  });

  it('accepts all valid sort_order enum values', () => {
    const sortOrders = [
      'alpha-asc',
      'alpha-desc',
      'best-selling',
      'created',
      'created-desc',
      'manual',
      'price-asc',
      'price-desc',
    ] as const;
    for (const sort_order of sortOrders) {
      const result = CustomCollectionSchema.safeParse({ ...baseCustomCollection, sort_order });
      expect(result.success).toBe(true);
    }
  });

  it('accepts nullable optional fields', () => {
    const withNulls = {
      ...baseCustomCollection,
      body_html: null,
      seo_title: null,
      seo_description: null,
      image: null,
    };
    const result = CustomCollectionSchema.safeParse(withNulls);
    expect(result.success).toBe(true);
  });

  it('passes through unknown fields', () => {
    const withExtra = { ...baseCustomCollection, custom_field: 'web-batch-a' };
    const result = CustomCollectionSchema.parse(withExtra);
    expect((result as Record<string, unknown>).custom_field).toBe('web-batch-a');
  });

  it('parses image sub-object', () => {
    const withImage = {
      ...baseCustomCollection,
      image: { src: 'https://cdn.sapo.io/img.jpg', alt: 'Ảnh bộ sưu tập' },
    };
    const result = CustomCollectionSchema.safeParse(withImage);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.image?.src).toBe('https://cdn.sapo.io/img.jpg');
    }
  });
});

describe('CustomCollectionSingleResponseSchema', () => {
  it('parses wrapped single response', () => {
    const result = CustomCollectionSingleResponseSchema.safeParse({
      custom_collection: baseCustomCollection,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.custom_collection.id).toBe(100001);
    }
  });
});

describe('CustomCollectionListResponseSchema', () => {
  it('parses list response', () => {
    const result = CustomCollectionListResponseSchema.safeParse({
      custom_collections: [baseCustomCollection],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.custom_collections).toHaveLength(1);
    }
  });

  it('parses empty list', () => {
    const result = CustomCollectionListResponseSchema.safeParse({ custom_collections: [] });
    expect(result.success).toBe(true);
  });
});

describe('SmartCollectionSchema', () => {
  it('parses a smart collection with rules', () => {
    const result = SmartCollectionSchema.safeParse(baseSmartCollection);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(200001);
      expect(result.data.rules).toHaveLength(1);
      expect(result.data.rules?.[0].column).toBe('tag');
    }
  });

  it('uses created_on NOT created_at (Sapo convention)', () => {
    const result = SmartCollectionSchema.safeParse(baseSmartCollection);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.created_on).toBe('2026-02-01T09:00:00Z');
      expect((result.data as Record<string, unknown>).created_at).toBeUndefined();
    }
  });

  it('requires id, title, created_on, modified_on', () => {
    const { id: _id, ...without } = baseSmartCollection;
    expect(SmartCollectionSchema.safeParse(without).success).toBe(false);
  });

  it('passes through unknown fields', () => {
    const withExtra = { ...baseSmartCollection, extra_data: 'test' };
    const result = SmartCollectionSchema.parse(withExtra);
    expect((result as Record<string, unknown>).extra_data).toBe('test');
  });

  it('accepts disjunctive=true for OR-based rules', () => {
    const disjunctive = { ...baseSmartCollection, disjunctive: true };
    const result = SmartCollectionSchema.safeParse(disjunctive);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.disjunctive).toBe(true);
    }
  });
});

describe('SmartCollectionSingleResponseSchema', () => {
  it('parses wrapped single response', () => {
    const result = SmartCollectionSingleResponseSchema.safeParse({
      smart_collection: baseSmartCollection,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.smart_collection.id).toBe(200001);
    }
  });
});

describe('SmartCollectionListResponseSchema', () => {
  it('parses list response', () => {
    const result = SmartCollectionListResponseSchema.safeParse({
      smart_collections: [baseSmartCollection],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.smart_collections).toHaveLength(1);
    }
  });
});
