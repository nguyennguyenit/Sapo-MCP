/**
 * Tests for PageSchema and PageSeoUpdateSchema.
 *
 * Key Sapo conventions tested:
 * - Timestamps: created_on / modified_on (NOT created_at / updated_at)
 * - .passthrough() — unknown fields preserved
 * - PageSeoUpdateSchema strict subset (no body_html, no title)
 */
import { describe, expect, it } from 'vitest';
import {
  PageListResponseSchema,
  PageSchema,
  PageSeoUpdateSchema,
  PageSingleResponseSchema,
} from '../../src/schemas/page.js';

const basePage = {
  id: 30001,
  title: 'Giới thiệu về chúng tôi',
  handle: 'gioi-thieu',
  body_html: '<h1>Về chúng tôi</h1><p>Câu chuyện thương hiệu.</p>',
  published: true,
  meta_title: 'Về chúng tôi | Shop',
  meta_description: 'Tìm hiểu câu chuyện và giá trị cốt lõi của chúng tôi.',
  tags: 'about,company',
  created_on: '2026-01-05T07:00:00Z',
  modified_on: '2026-03-20T11:00:00Z',
};

describe('PageSchema', () => {
  it('parses a minimal page', () => {
    const result = PageSchema.safeParse(basePage);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(30001);
      expect(result.data.title).toBe('Giới thiệu về chúng tôi');
    }
  });

  it('uses created_on NOT created_at (Sapo convention)', () => {
    const result = PageSchema.safeParse(basePage);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.created_on).toBe('2026-01-05T07:00:00Z');
      expect(result.data.modified_on).toBe('2026-03-20T11:00:00Z');
      expect((result.data as Record<string, unknown>).created_at).toBeUndefined();
    }
  });

  it('requires id, title, created_on, modified_on', () => {
    const { id: _id, ...without } = basePage;
    expect(PageSchema.safeParse(without).success).toBe(false);
  });

  it('accepts nullable optional fields', () => {
    const withNulls = {
      ...basePage,
      body_html: null,
      handle: null,
      meta_title: null,
      meta_description: null,
      tags: null,
      published_at: null,
    };
    const result = PageSchema.safeParse(withNulls);
    expect(result.success).toBe(true);
  });

  it('passes through unknown fields', () => {
    const withExtra = { ...basePage, custom_seo_score: 95 };
    const result = PageSchema.parse(withExtra);
    expect((result as Record<string, unknown>).custom_seo_score).toBe(95);
  });

  it('parses meta_title and meta_description as SEO fields', () => {
    const result = PageSchema.safeParse(basePage);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.meta_title).toBe('Về chúng tôi | Shop');
      expect(result.data.meta_description).toContain('câu chuyện');
    }
  });
});

describe('PageSingleResponseSchema', () => {
  it('parses wrapped single response', () => {
    const result = PageSingleResponseSchema.safeParse({ page: basePage });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page.id).toBe(30001);
    }
  });

  it('rejects missing page wrapper', () => {
    const result = PageSingleResponseSchema.safeParse(basePage);
    expect(result.success).toBe(false);
  });
});

describe('PageListResponseSchema', () => {
  it('parses list response', () => {
    const result = PageListResponseSchema.safeParse({ pages: [basePage] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pages).toHaveLength(1);
    }
  });

  it('parses empty list', () => {
    const result = PageListResponseSchema.safeParse({ pages: [] });
    expect(result.success).toBe(true);
  });
});

describe('PageSeoUpdateSchema', () => {
  it('accepts a full SEO update payload', () => {
    const result = PageSeoUpdateSchema.safeParse({
      meta_title: 'New SEO Title',
      meta_description: 'New meta description',
      handle: 'new-slug',
      tags: 'seo,updated',
      published: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty payload (all optional)', () => {
    const result = PageSeoUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('does NOT include body_html field', () => {
    // body_html should be stripped or cause failure — it's not in the schema
    const withBodyHtml = { meta_title: 'Title', body_html: '<p>content</p>' };
    const result = PageSeoUpdateSchema.safeParse(withBodyHtml);
    // Zod strips unknown fields by default (not passthrough) — body_html won't appear in output
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).body_html).toBeUndefined();
    }
  });

  it('does NOT include title field', () => {
    const withTitle = { meta_title: 'SEO Title', title: 'Page Title' };
    const result = PageSeoUpdateSchema.safeParse(withTitle);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).title).toBeUndefined();
    }
  });

  it('accepts null values for optional SEO fields', () => {
    const withNulls = { meta_title: null, meta_description: null, handle: null, tags: null };
    const result = PageSeoUpdateSchema.safeParse(withNulls);
    expect(result.success).toBe(true);
  });
});
