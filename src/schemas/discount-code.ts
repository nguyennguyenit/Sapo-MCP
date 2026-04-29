/**
 * DiscountCodeSchema — Sapo Discount Code resource.
 *
 * Key conventions (verified against live fixture 2026-04-30):
 * - Timestamps: created_on / modified_on (NOT created_at / updated_at)
 * - Discount codes are nested under price_rules
 * - Simple shape: id, code, usage_count, timestamps
 */

import { z } from 'zod';

// ── Main schema ──────────────────────────────────────────────────────────────

export const DiscountCodeSchema = z
  .object({
    id: z.number().int(),
    code: z.string(),
    created_on: z.string(),
    modified_on: z.string(),
    usage_count: z.number().int().optional(),
    price_rule_id: z.number().int().optional(),
  })
  .passthrough();

export const DiscountCodeListResponseSchema = z
  .object({
    discount_codes: z.array(DiscountCodeSchema),
  })
  .passthrough();

export const DiscountCodeSingleResponseSchema = z
  .object({
    discount_code: DiscountCodeSchema,
  })
  .passthrough();

export type DiscountCode = z.infer<typeof DiscountCodeSchema>;
