/**
 * ProductSeoInputSchema — strict subset of ProductSchema for SEO-only updates.
 *
 * INTENTIONALLY NARROW: only exposes meta_title, meta_description, slug/alias, and tags.
 * Does NOT expose price, stock, variants, images, or any other product fields.
 * For full product edits, use a dedicated product management tool.
 *
 * Endpoint: PUT /admin/products/{id}.json
 */

import { z } from 'zod';

/**
 * Input schema for update_product_seo.
 * Zod will reject any field not listed here (no .passthrough() — strict by design).
 */
export const ProductSeoInputSchema = z.object({
  /** SEO meta title override (shown in search engine results). */
  meta_title: z.string().optional().nullable(),
  /** SEO meta description (shown in search snippets). */
  meta_description: z.string().optional().nullable(),
  /**
   * URL slug/handle for the product page.
   * Sapo calls this field "alias" in product responses.
   * Accepted as "slug" here for LLM ergonomics and mapped to "alias" in the request body.
   */
  slug: z.string().optional().nullable(),
  /** Comma-separated tag string used for SEO categorization and filtering. */
  tags: z.string().optional().nullable(),
});

export type ProductSeoInput = z.infer<typeof ProductSeoInputSchema>;

/**
 * Response shape for a successful SEO update — only SEO fields returned.
 * Uses .passthrough() to tolerate extra API fields without failing validation.
 */
export const ProductSeoResponseSchema = z
  .object({
    id: z.number().int(),
    meta_title: z.string().optional().nullable(),
    meta_description: z.string().optional().nullable(),
    alias: z.string().optional().nullable(),
    tags: z.string().optional().nullable(),
    modified_on: z.string(),
  })
  .passthrough();

export type ProductSeoResponse = z.infer<typeof ProductSeoResponseSchema>;

export const ProductSeoSingleResponseSchema = z
  .object({ product: ProductSeoResponseSchema })
  .passthrough();
