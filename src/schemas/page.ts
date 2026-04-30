/**
 * PageSchema — Sapo Page resource.
 *
 * Sapo conventions:
 * - Timestamps: created_on / modified_on (NOT created_at / updated_at)
 * - .passthrough() for API drift tolerance
 * - Page body is raw HTML — pass-through, no sanitization.
 *
 * Endpoints: /admin/pages.json, /admin/pages/{id}.json
 *
 * SEO-update subset (used by update_page_seo tool):
 *   meta_title, meta_description, handle (slug), tags, published
 * Full body/content updates are deferred (update_page — Batch C+).
 */

import { z } from 'zod';

export const PageSchema = z
  .object({
    id: z.number().int(),
    title: z.string(),
    /** HTML body content — NOT sanitized; XSS prevention is caller's responsibility */
    body_html: z.string().optional().nullable(),
    handle: z.string().optional().nullable().describe('URL slug for the page.'),
    author: z.string().optional().nullable(),
    published: z.boolean().optional(),
    published_at: z.string().optional().nullable(),
    template_suffix: z.string().optional().nullable(),
    /** SEO meta title override */
    meta_title: z.string().optional().nullable(),
    /** SEO meta description override */
    meta_description: z.string().optional().nullable(),
    tags: z.string().optional().nullable().describe('Comma-separated tag string.'),
    created_on: z.string(),
    /** Nullable in live data when page never modified after creation. */
    modified_on: z.string().nullable(),
  })
  .passthrough();

export type Page = z.infer<typeof PageSchema>;

export const PageSingleResponseSchema = z.object({ page: PageSchema }).passthrough();

export const PageListResponseSchema = z.object({ pages: z.array(PageSchema) }).passthrough();

/**
 * SEO-only update input — strict subset of PageSchema.
 * Intentionally excludes: body_html, title, author, template_suffix.
 * For full page edits use update_page (deferred to Batch C+).
 */
export const PageSeoUpdateSchema = z.object({
  meta_title: z.string().optional().nullable(),
  meta_description: z.string().optional().nullable(),
  handle: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
  published: z.boolean().optional(),
});

export type PageSeoUpdate = z.infer<typeof PageSeoUpdateSchema>;
