/**
 * ProductSchema — Sapo Product resource (read-only shape).
 *
 * Key Sapo conventions:
 * - status: active | archived | draft
 * - price / compare_at_price: FLOAT VND (Sapo serializes with 4 decimals: 150000.0000)
 * - Timestamps: created_on / modified_on
 * - variants: summary array embedded in product response
 * - options: product option definitions (name + values)
 */

import { z } from 'zod';
import { VariantSchema } from './variant.js';

export const ProductStatusEnum = z.enum(['active', 'archived', 'draft']);

const ProductOptionSchema = z
  .object({
    id: z.number().int().optional(),
    product_id: z.number().int().optional(),
    name: z.string(),
    position: z.number().int().optional(),
    values: z.array(z.string()).optional(),
    created_on: z.string().optional(),
    modified_on: z.string().optional(),
  })
  .passthrough();

const ProductImageSchema = z
  .object({
    id: z.number().int(),
    product_id: z.number().int().optional(),
    src: z.string(),
    alt: z.string().optional().nullable(),
    position: z.number().int().optional(),
    created_on: z.string().optional(),
    modified_on: z.string().optional(),
  })
  .passthrough();

export const ProductSchema = z
  .object({
    id: z.number().int(),
    /**
     * Sapo uses "name" as the primary product title field (NOT "title").
     * Some endpoints / SDK wrappers may surface "title" as an alias; both are nullable.
     */
    name: z.string().nullable().optional(),
    /** Shopify-style alias for name — may be absent in real Sapo responses. */
    title: z.string().nullable().optional(),
    description: z.string().optional().nullable(),
    /** HTML product body (Sapo field name). Alias for description. */
    content: z.string().optional().nullable(),
    vendor: z.string().optional().nullable(),
    product_type: z.string().optional().nullable(),
    /** URL alias / slug (Sapo calls it "alias", not "handle"). */
    alias: z.string().optional().nullable(),
    handle: z.string().optional().nullable(),
    status: ProductStatusEnum.optional(),
    /** Primary variant price in VND as float (Sapo serializes with 4 decimals) */
    price: z.number().optional().nullable(),
    compare_at_price: z.number().optional().nullable(),
    tags: z.string().optional().nullable(),
    options: z.array(ProductOptionSchema).optional(),
    variants: z.array(VariantSchema).optional(),
    images: z.array(ProductImageSchema).optional(),
    created_on: z.string(),
    modified_on: z.string(),
  })
  .passthrough();

export type Product = z.infer<typeof ProductSchema>;

export const ProductSingleResponseSchema = z.object({ product: ProductSchema }).passthrough();

export type ProductSingleResponse = z.infer<typeof ProductSingleResponseSchema>;

export const ProductListResponseSchema = z
  .object({ products: z.array(ProductSchema) })
  .passthrough();

export type ProductListResponse = z.infer<typeof ProductListResponseSchema>;
