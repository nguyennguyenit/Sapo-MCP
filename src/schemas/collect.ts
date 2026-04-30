/**
 * CollectSchema — Sapo Collect resource (product ↔ collection mapping).
 *
 * A Collect record represents the association between a product and a custom collection.
 * Smart collections manage their own products automatically via rules.
 *
 * Sapo conventions:
 * - Timestamps: created_on / modified_on (NOT created_at / updated_at)
 */

import { z } from 'zod';

export const CollectSchema = z
  .object({
    id: z.number().int(),
    collection_id: z.number().int(),
    product_id: z.number().int(),
    /** Position within collection (for manual sort_order collections) */
    position: z.number().int().optional(),
    sort_value: z.string().optional().nullable(),
    created_on: z.string(),
    modified_on: z.string(),
  })
  .passthrough();

export type Collect = z.infer<typeof CollectSchema>;

export const CollectSingleResponseSchema = z.object({ collect: CollectSchema }).passthrough();

export const CollectListResponseSchema = z
  .object({ collects: z.array(CollectSchema) })
  .passthrough();
