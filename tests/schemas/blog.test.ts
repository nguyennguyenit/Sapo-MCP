/**
 * Tests for BlogSchema.
 *
 * Key Sapo conventions tested:
 * - Timestamps: created_on / modified_on (NOT created_at / updated_at)
 * - .passthrough() — unknown fields preserved
 * - commentable enum values
 */
import { describe, expect, it } from 'vitest';
import {
  BlogListResponseSchema,
  BlogSchema,
  BlogSingleResponseSchema,
} from '../../src/schemas/blog.js';

const baseBlog = {
  id: 10001,
  title: 'Tin tức & Sự kiện',
  handle: 'tin-tuc-su-kien',
  commentable: 'moderate' as const,
  tags: 'news,events',
  created_on: '2026-01-10T08:00:00Z',
  modified_on: '2026-04-01T09:00:00Z',
};

describe('BlogSchema', () => {
  it('parses a minimal blog', () => {
    const result = BlogSchema.safeParse(baseBlog);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(10001);
      expect(result.data.title).toBe('Tin tức & Sự kiện');
    }
  });

  it('uses created_on NOT created_at (Sapo convention)', () => {
    const result = BlogSchema.safeParse(baseBlog);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.created_on).toBe('2026-01-10T08:00:00Z');
      expect(result.data.modified_on).toBe('2026-04-01T09:00:00Z');
      expect((result.data as Record<string, unknown>).created_at).toBeUndefined();
    }
  });

  it('requires id, title, created_on, modified_on', () => {
    const { id: _id, ...without } = baseBlog;
    expect(BlogSchema.safeParse(without).success).toBe(false);
  });

  it('accepts all valid commentable enum values', () => {
    for (const commentable of ['no', 'moderate', 'yes'] as const) {
      const result = BlogSchema.safeParse({ ...baseBlog, commentable });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid commentable value', () => {
    const result = BlogSchema.safeParse({ ...baseBlog, commentable: 'open' });
    expect(result.success).toBe(false);
  });

  it('accepts nullable optional fields', () => {
    const withNulls = { ...baseBlog, handle: null, feedburner: null, tags: null };
    const result = BlogSchema.safeParse(withNulls);
    expect(result.success).toBe(true);
  });

  it('passes through unknown fields', () => {
    const withExtra = { ...baseBlog, custom_field: 'web-batch-b' };
    const result = BlogSchema.parse(withExtra);
    expect((result as Record<string, unknown>).custom_field).toBe('web-batch-b');
  });

  it('allows blog without commentable (defaults to undefined)', () => {
    const { commentable: _c, ...without } = baseBlog;
    const result = BlogSchema.safeParse(without);
    expect(result.success).toBe(true);
  });
});

describe('BlogSingleResponseSchema', () => {
  it('parses wrapped single response', () => {
    const result = BlogSingleResponseSchema.safeParse({ blog: baseBlog });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.blog.id).toBe(10001);
    }
  });

  it('rejects missing blog wrapper', () => {
    const result = BlogSingleResponseSchema.safeParse(baseBlog);
    expect(result.success).toBe(false);
  });
});

describe('BlogListResponseSchema', () => {
  it('parses list response', () => {
    const result = BlogListResponseSchema.safeParse({ blogs: [baseBlog] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.blogs).toHaveLength(1);
    }
  });

  it('parses empty list', () => {
    const result = BlogListResponseSchema.safeParse({ blogs: [] });
    expect(result.success).toBe(true);
  });
});
