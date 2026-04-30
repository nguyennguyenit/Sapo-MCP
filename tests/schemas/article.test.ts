/**
 * Tests for ArticleSchema.
 *
 * Key Sapo conventions tested:
 * - Timestamps: created_on / modified_on (NOT created_at / updated_at)
 * - .passthrough() — unknown fields preserved
 * - body_html is raw HTML pass-through (no sanitization)
 */
import { describe, expect, it } from 'vitest';
import {
  ArticleListResponseSchema,
  ArticleSchema,
  ArticleSingleResponseSchema,
} from '../../src/schemas/article.js';

const baseArticle = {
  id: 20001,
  blog_id: 10001,
  title: 'Hướng dẫn mua sắm online',
  body_html: '<p>Nội dung bài viết <strong>chi tiết</strong></p>',
  author: 'Nguyễn Văn A',
  handle: 'huong-dan-mua-sam-online',
  tags: 'guide,shopping',
  published: true,
  created_on: '2026-02-01T08:00:00Z',
  modified_on: '2026-04-10T10:00:00Z',
};

describe('ArticleSchema', () => {
  it('parses a minimal article', () => {
    const result = ArticleSchema.safeParse(baseArticle);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(20001);
      expect(result.data.blog_id).toBe(10001);
      expect(result.data.title).toBe('Hướng dẫn mua sắm online');
    }
  });

  it('uses created_on NOT created_at (Sapo convention)', () => {
    const result = ArticleSchema.safeParse(baseArticle);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.created_on).toBe('2026-02-01T08:00:00Z');
      expect(result.data.modified_on).toBe('2026-04-10T10:00:00Z');
      expect((result.data as Record<string, unknown>).created_at).toBeUndefined();
    }
  });

  it('requires id, blog_id, title, created_on, modified_on', () => {
    const { id: _id, ...without } = baseArticle;
    expect(ArticleSchema.safeParse(without).success).toBe(false);
  });

  it('accepts raw HTML in body_html (no sanitization)', () => {
    const withXssAttempt = {
      ...baseArticle,
      body_html: '<script>alert("xss")</script><p>Content</p>',
    };
    const result = ArticleSchema.safeParse(withXssAttempt);
    // Schema passes it through — caller is responsible for XSS prevention
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body_html).toContain('<script>');
    }
  });

  it('accepts nullable optional fields', () => {
    const withNulls = {
      ...baseArticle,
      body_html: null,
      summary_html: null,
      author: null,
      handle: null,
      tags: null,
      image: null,
      seo_title: null,
      seo_description: null,
    };
    const result = ArticleSchema.safeParse(withNulls);
    expect(result.success).toBe(true);
  });

  it('parses image sub-object', () => {
    const withImage = {
      ...baseArticle,
      image: { src: 'https://cdn.sapo.io/article.jpg', alt: 'Ảnh bài viết' },
    };
    const result = ArticleSchema.safeParse(withImage);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.image?.src).toBe('https://cdn.sapo.io/article.jpg');
    }
  });

  it('parses seo_title and seo_description fields', () => {
    const withSeo = {
      ...baseArticle,
      seo_title: 'Mua sắm online hiệu quả | Shop',
      seo_description: 'Hướng dẫn chi tiết cách mua sắm online an toàn và tiết kiệm.',
    };
    const result = ArticleSchema.safeParse(withSeo);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.seo_title).toBe('Mua sắm online hiệu quả | Shop');
    }
  });

  it('passes through unknown fields', () => {
    const withExtra = { ...baseArticle, extra_data: 'batch-b' };
    const result = ArticleSchema.parse(withExtra);
    expect((result as Record<string, unknown>).extra_data).toBe('batch-b');
  });
});

describe('ArticleSingleResponseSchema', () => {
  it('parses wrapped single response', () => {
    const result = ArticleSingleResponseSchema.safeParse({ article: baseArticle });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.article.id).toBe(20001);
    }
  });

  it('rejects missing article wrapper', () => {
    const result = ArticleSingleResponseSchema.safeParse(baseArticle);
    expect(result.success).toBe(false);
  });
});

describe('ArticleListResponseSchema', () => {
  it('parses list response', () => {
    const result = ArticleListResponseSchema.safeParse({ articles: [baseArticle] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.articles).toHaveLength(1);
    }
  });

  it('parses empty list', () => {
    const result = ArticleListResponseSchema.safeParse({ articles: [] });
    expect(result.success).toBe(true);
  });

  it('parses multiple articles', () => {
    const second = { ...baseArticle, id: 20002, title: 'Bài viết thứ 2' };
    const result = ArticleListResponseSchema.safeParse({ articles: [baseArticle, second] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.articles).toHaveLength(2);
    }
  });
});
