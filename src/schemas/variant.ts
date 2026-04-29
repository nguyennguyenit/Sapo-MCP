/**
 * VariantSchema — Sapo Product Variant resource (read-only fields).
 *
 * Key Sapo conventions (verified live API 2026-04-30, store giapducthangscs):
 * - price: FLOAT VND (e.g. 150000.0000). NOT integer — Sapo serializes with 4 decimals
 * - compare_at_price: float or null
 * - inventory_quantity: float (Sapo allows fractional inventory)
 * - Timestamps: created_on / modified_on (Sapo convention)
 * - inventory_management: "sapo" | null (not "shopify")
 */

import { z } from 'zod';

export const VariantSchema = z
  .object({
    id: z.number().int(),
    product_id: z.number().int(),
    title: z.string().optional(),
    /** Price in VND as float (e.g. 150000.0000 = 150,000₫). Sapo serializes with 4 decimals. */
    price: z.number(),
    /** Compare-at price in VND; null if no original price shown */
    compare_at_price: z.number().nullable().optional(),
    sku: z.string().optional().nullable(),
    barcode: z.string().optional().nullable(),
    option1: z.string().nullable().optional(),
    option2: z.string().nullable().optional(),
    option3: z.string().nullable().optional(),
    inventory_quantity: z.number().optional(),
    /** "sapo" if Sapo tracks inventory; null if unmanaged */
    inventory_management: z.string().nullable().optional(),
    inventory_policy: z.enum(['deny', 'continue']).optional(),
    position: z.number().int().optional(),
    image_id: z.number().int().nullable().optional(),
    weight: z.number().optional().nullable(),
    weight_unit: z.string().optional().nullable(),
    requires_shipping: z.boolean().optional(),
    taxable: z.boolean().optional(),
    created_on: z.string(),
    modified_on: z.string(),
  })
  .passthrough();

export type Variant = z.infer<typeof VariantSchema>;

export const VariantSingleResponseSchema = z.object({ variant: VariantSchema }).passthrough();

export type VariantSingleResponse = z.infer<typeof VariantSingleResponseSchema>;

export const VariantListResponseSchema = z
  .object({ variants: z.array(VariantSchema) })
  .passthrough();

export type VariantListResponse = z.infer<typeof VariantListResponseSchema>;
