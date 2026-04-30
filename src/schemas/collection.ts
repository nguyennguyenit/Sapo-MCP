/**
 * CollectionSchema — Sapo Custom Collection and Smart Collection resources.
 *
 * Sapo conventions:
 * - Timestamps: created_on / modified_on (NOT created_at / updated_at)
 * - Custom collections: manually curated product sets
 * - Smart collections: rule-based automatic product sets
 * - sort_order: alpha-asc, alpha-desc, best-selling, created, created-desc, manual, price-asc, price-desc
 */

import { z } from 'zod';

export const CollectionSortOrderEnum = z.enum([
  'alpha-asc',
  'alpha-desc',
  'best-selling',
  'created',
  'created-desc',
  'manual',
  'price-asc',
  'price-desc',
]);

const CollectionImageSchema = z
  .object({
    src: z.string(),
    alt: z.string().optional().nullable(),
    created_on: z.string().optional(),
  })
  .passthrough();

// ── Custom Collection ──────────────────────────────────────────────────────────

export const CustomCollectionSchema = z
  .object({
    id: z.number().int(),
    title: z.string(),
    /** URL alias / slug (Sapo field name) */
    alias: z.string().optional().nullable(),
    handle: z.string().optional().nullable(),
    body_html: z.string().optional().nullable(),
    sort_order: CollectionSortOrderEnum.optional(),
    template_suffix: z.string().optional().nullable(),
    published: z.boolean().optional(),
    published_at: z.string().optional().nullable(),
    published_scope: z.string().optional(),
    image: CollectionImageSchema.optional().nullable(),
    /** SEO meta fields */
    seo_title: z.string().optional().nullable(),
    seo_description: z.string().optional().nullable(),
    created_on: z.string(),
    modified_on: z.string(),
  })
  .passthrough();

export type CustomCollection = z.infer<typeof CustomCollectionSchema>;

export const CustomCollectionSingleResponseSchema = z
  .object({ custom_collection: CustomCollectionSchema })
  .passthrough();

export const CustomCollectionListResponseSchema = z
  .object({ custom_collections: z.array(CustomCollectionSchema) })
  .passthrough();

// ── Smart Collection ───────────────────────────────────────────────────────────

const SmartCollectionRuleSchema = z
  .object({
    column: z.string(),
    relation: z.string(),
    condition: z.string(),
  })
  .passthrough();

export const SmartCollectionSchema = z
  .object({
    id: z.number().int(),
    title: z.string(),
    alias: z.string().optional().nullable(),
    handle: z.string().optional().nullable(),
    body_html: z.string().optional().nullable(),
    sort_order: CollectionSortOrderEnum.optional(),
    template_suffix: z.string().optional().nullable(),
    published: z.boolean().optional(),
    published_at: z.string().optional().nullable(),
    published_scope: z.string().optional(),
    disjunctive: z.boolean().optional(),
    rules: z.array(SmartCollectionRuleSchema).optional(),
    image: CollectionImageSchema.optional().nullable(),
    seo_title: z.string().optional().nullable(),
    seo_description: z.string().optional().nullable(),
    created_on: z.string(),
    modified_on: z.string(),
  })
  .passthrough();

export type SmartCollection = z.infer<typeof SmartCollectionSchema>;

export const SmartCollectionSingleResponseSchema = z
  .object({ smart_collection: SmartCollectionSchema })
  .passthrough();

export const SmartCollectionListResponseSchema = z
  .object({ smart_collections: z.array(SmartCollectionSchema) })
  .passthrough();
