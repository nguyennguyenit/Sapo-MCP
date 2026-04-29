/**
 * DraftOrderSchema — Sapo Draft Order resource.
 *
 * Key conventions (verified against live fixture 2026-04-30):
 * - Timestamps: created_on / modified_on (NOT created_at / updated_at)
 * - Currency amounts: FLOAT (z.number()) in VND
 * - Status: "open" | "completed" | "invoice_sent" | "cancelled"
 * - Many VN-specific fields (expected_delivery_date, expected_payment_method_id,
 *   shipment_category, etc.) — passthrough heavily
 * - billing_address / shipping_address: nullable (draft orders often lack addresses)
 * - line_items: required array (at least 1 item)
 */

import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────────────────

export const DraftOrderStatusEnum = z.enum(['open', 'completed', 'invoice_sent', 'cancelled']);

// ── Nested schemas ───────────────────────────────────────────────────────────

/**
 * Line item in a draft order (different from order line item — no `id` required).
 */
const DraftOrderLineItemSchema = z
  .object({
    variant_id: z.number().int().optional().nullable(),
    inventory_item_id: z.number().int().optional().nullable(),
    product_id: z.number().int().optional().nullable(),
    title: z.string().optional().nullable(),
    variant_title: z.string().optional().nullable(),
    sku: z.string().optional().nullable(),
    vendor: z.string().optional().nullable(),
    price: z.number(),
    price_override: z.number().optional().nullable(),
    quantity: z.number().int(),
    requires_shipping: z.boolean().optional(),
    fulfillment_service: z.string().optional().nullable(),
    grams: z.number().optional().nullable(),
    applied_discount: z.unknown().nullable().optional(),
    name: z.string().optional().nullable(),
    properties: z.array(z.unknown()).optional(),
    tax_lines: z.array(z.unknown()).optional(),
    custom: z.boolean().optional(),
    taxable: z.boolean().optional(),
    lot_management: z.boolean().optional(),
    discounted_total: z.number().optional().nullable(),
    discounted_unit_price: z.number().optional().nullable(),
    total_original: z.number().optional().nullable(),
    token: z.string().optional().nullable(),
    inventory_policy: z.string().optional().nullable(),
    inventory_management: z.string().optional().nullable(),
    discount_allocations: z.array(z.unknown()).optional(),
    components: z.array(z.unknown()).optional(),
    type: z.string().optional().nullable(),
    unit: z.unknown().nullable().optional(),
    item_unit: z.unknown().nullable().optional(),
    image: z.unknown().nullable().optional(),
    catalog_id: z.number().int().optional().nullable(),
    note: z.string().optional().nullable(),
    total_discount: z.number().optional().nullable(),
  })
  .passthrough();

/**
 * Address on a draft order (billing or shipping).
 * Nullable at top level — draft orders often omit addresses.
 */
const DraftOrderAddressSchema = z
  .object({
    first_name: z.string().optional().nullable(),
    last_name: z.string().optional().nullable(),
    name: z.string().optional().nullable(),
    company: z.string().optional().nullable(),
    address1: z.string().optional().nullable(),
    address2: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    province: z.string().optional().nullable(),
    district: z.string().optional().nullable(),
    ward: z.string().optional().nullable(),
    zip: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
    country_code: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
  })
  .passthrough();

// ── Main schema ──────────────────────────────────────────────────────────────

export const DraftOrderSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    status: DraftOrderStatusEnum,
    created_on: z.string(),
    modified_on: z.string(),

    // Financial totals (float VND)
    total_price: z.number(),
    subtotal_price: z.number().optional().nullable(),
    total_tax: z.number().optional().nullable(),
    total_discounts: z.number().optional().nullable(),
    total_shipping_price: z.number().optional().nullable(),
    total_line_items_price: z.number().optional().nullable(),
    line_items_subtotal_price: z.number().optional().nullable(),

    currency: z.string(),
    taxes_included: z.boolean().optional(),
    tax_exempt: z.boolean().optional(),
    grams: z.number().optional().nullable(),

    // Relations
    order_id: z.number().int().optional().nullable(),
    copy_order_id: z.number().int().optional().nullable(),
    location_id: z.number().int().optional().nullable(),
    user_id: z.number().int().optional().nullable(),
    assignee_id: z.number().int().optional().nullable(),
    customer_group_id: z.number().int().optional().nullable(),
    expected_payment_method_id: z.number().int().optional().nullable(),

    // Contact
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    note: z.string().optional().nullable(),
    tags: z.string().optional().nullable(),
    source_name: z.string().optional().nullable(),
    source_url: z.string().optional().nullable(),
    referring_site: z.string().optional().nullable(),

    // Timestamps (optional)
    completed_on: z.string().optional().nullable(),
    processed_on: z.string().optional().nullable(),

    // VN-specific
    shipment_category: z.string().optional().nullable(),
    shipment_deadline: z.string().optional().nullable(),
    expected_delivery_date: z.string().optional().nullable(),
    channel_definition: z.unknown().nullable().optional(),

    // Nested objects
    billing_address: DraftOrderAddressSchema.nullable().optional(),
    shipping_address: DraftOrderAddressSchema.nullable().optional(),
    customer: z.unknown().nullable().optional(),
    applied_discount: z.unknown().nullable().optional(),
    shipping_line: z.unknown().nullable().optional(),
    line_items: z.array(DraftOrderLineItemSchema),

    // Arrays
    note_attributes: z.array(z.unknown()).optional(),
    discount_applications: z.array(z.unknown()).optional(),
    applied_discounts: z.array(z.unknown()).optional(),
    discount_codes: z.array(z.unknown()).optional(),
    discount_violations: z.array(z.unknown()).optional(),
    shipping_lines: z.array(z.unknown()).optional(),
    invoices: z.array(z.unknown()).optional(),
    tax_lines: z.array(z.unknown()).optional(),

    // Flags
    automatic_discounts_override: z.boolean().optional(),
  })
  .passthrough();

export const DraftOrderListResponseSchema = z.object({
  draft_orders: z.array(DraftOrderSchema),
});

export const DraftOrderSingleResponseSchema = z.object({
  draft_order: DraftOrderSchema,
});

export type DraftOrder = z.infer<typeof DraftOrderSchema>;
