/**
 * PriceRuleSchema — Sapo Price Rule resource.
 *
 * Key conventions (verified against live fixture 2026-04-30):
 * - Timestamps: created_on / modified_on (NOT created_at / updated_at)
 * - value is STRING (e.g. "-10.0"), NOT a number — Sapo serializes it as string
 * - value_type: "percentage" | "fixed_amount" | "shipping"
 * - target_type: "line_item" | "shipping_line"
 * - target_selection: "all" | "entitled"
 * - allocation_method: "across" | "each"
 * - customer_selection: "all" | "prerequisite"
 * - status: "active" | "archived" | "scheduled"
 * - location_selection: "all" | "entitled" (VN-specific)
 * - 30+ optional fields — passthrough heavily
 */

import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────────────────

export const PriceRuleValueTypeEnum = z.enum(['percentage', 'fixed_amount', 'shipping']);
export const PriceRuleTargetTypeEnum = z.enum(['line_item', 'shipping_line']);
export const PriceRuleTargetSelectionEnum = z.enum(['all', 'entitled']);
export const PriceRuleAllocationMethodEnum = z.enum(['across', 'each']);
export const PriceRuleCustomerSelectionEnum = z.enum(['all', 'prerequisite']);
export const PriceRuleStatusEnum = z.enum(['active', 'archived', 'scheduled']);

// ── Nested schemas ───────────────────────────────────────────────────────────

const CombinesWithSchema = z
  .object({
    order_discount: z.boolean().optional(),
    product_discount: z.boolean().optional(),
    shipping_discount: z.boolean().optional(),
  })
  .passthrough();

// ── Main schema ──────────────────────────────────────────────────────────────

export const PriceRuleSchema = z
  .object({
    id: z.number().int(),
    title: z.string(),

    // value is a STRING in Sapo (e.g. "-10.0"), not a number
    value: z.string(),
    value_type: PriceRuleValueTypeEnum,
    target_type: PriceRuleTargetTypeEnum,
    target_selection: PriceRuleTargetSelectionEnum,
    allocation_method: PriceRuleAllocationMethodEnum,
    customer_selection: PriceRuleCustomerSelectionEnum,

    // Timestamps (created_on/modified_on — confirmed from live fixture)
    created_on: z.string(),
    modified_on: z.string(),

    // Status
    status: PriceRuleStatusEnum.optional(),

    // Date range
    starts_on: z.string().optional().nullable(),
    ends_on: z.string().optional().nullable(),

    // Usage tracking
    times_used: z.number().int().optional(),
    usage_limit: z.number().int().optional().nullable(),
    once_per_customer: z.boolean().optional(),

    // VN-specific
    location_selection: z.string().optional().nullable(),
    exclude_type: z.boolean().optional(),
    value_limit_amount: z.number().optional().nullable(),
    allocation_limit: z.number().int().optional().nullable(),
    discount_class: z.string().optional().nullable(),
    summary: z.string().optional().nullable(),

    // Entitled entity IDs (arrays)
    entitled_product_ids: z.array(z.number().int()).optional(),
    entitled_variant_ids: z.array(z.number().int()).optional(),
    entitled_collection_ids: z.array(z.number().int()).optional(),
    entitled_country_ids: z.array(z.number().int()).optional(),
    entitled_province_ids: z.array(z.number().int()).optional(),
    channel_ids: z.array(z.number().int()).optional(),

    // Prerequisite ranges
    prerequisite_sale_total_range: z.unknown().nullable().optional(),
    prerequisite_subtotal_range: z.unknown().nullable().optional(),
    prerequisite_quantity_range: z.unknown().nullable().optional(),
    prerequisite_shipping_price_range: z.unknown().nullable().optional(),

    // Prerequisite entity IDs (arrays)
    prerequisite_saved_search_ids: z.array(z.number().int()).optional(),
    prerequisite_customer_group_ids: z.array(z.number().int()).optional(),
    prerequisite_location_ids: z.array(z.number().int()).optional(),
    prerequisite_product_ids: z.array(z.number().int()).optional(),
    prerequisite_variant_ids: z.array(z.number().int()).optional(),
    prerequisite_collection_ids: z.array(z.number().int()).optional(),

    // Advanced purchase conditions
    prerequisite_to_entitlement_purchase: z.unknown().nullable().optional(),
    prerequisite_to_entitlement_quantity_ratio: z.unknown().nullable().optional(),

    // Combination rules
    combines_with: CombinesWithSchema.optional().nullable(),
  })
  .passthrough();

export const PriceRuleListResponseSchema = z.object({
  price_rules: z.array(PriceRuleSchema),
});

export const PriceRuleSingleResponseSchema = z.object({
  price_rule: PriceRuleSchema,
});

export type PriceRule = z.infer<typeof PriceRuleSchema>;
