/**
 * ArticleSchema — Sapo Article resource.
 *
 * Sapo conventions:
 * - Timestamps: created_on / modified_on (NOT created_at / updated_at)
 * - .passthrough() for API drift tolerance
 * - Article body is raw HTML — pass-through, no sanitization.
 *   XSS responsibility rests with the caller/storefront renderer.
 *
 * Endpoints:
 *   /admin/blogs/{blog_id}/articles.json
 *   /admin/articles.json               (cross-blog list)
 *   /admin/blogs/{blog_id}/articles/{id}.json
 */

import { z } from 'zod';

const ArticleImageSchema = z
  .object({
    src: z.string(),
    alt: z.string().optional().nullable(),
    created_on: z.string().optional(),
  })
  .passthrough();

export const ArticleSchema = z
  .object({
    id: z.number().int(),
    blog_id: z.number().int(),
    title: z.string(),
    /** HTML body content — NOT sanitized, caller is responsible for XSS prevention */
    body_html: z.string().optional().nullable(),
    summary_html: z.string().optional().nullable(),
    author: z.string().optional().nullable(),
    handle: z.string().optional().nullable(),
    tags: z.string().optional().nullable().describe('Comma-separated tag string.'),
    published: z.boolean().optional(),
    published_at: z.string().optional().nullable(),
    template_suffix: z.string().optional().nullable(),
    image: ArticleImageSchema.optional().nullable(),
    /** SEO meta title override */
    seo_title: z.string().optional().nullable(),
    /** SEO meta description override */
    seo_description: z.string().optional().nullable(),
    created_on: z.string(),
    modified_on: z.string(),
  })
  .passthrough();

export type Article = z.infer<typeof ArticleSchema>;

export const ArticleSingleResponseSchema = z.object({ article: ArticleSchema }).passthrough();

export const ArticleListResponseSchema = z
  .object({ articles: z.array(ArticleSchema) })
  .passthrough();
