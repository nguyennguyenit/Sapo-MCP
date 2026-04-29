/**
 * OrderSchema — Sapo Order resource.
 *
 * Key conventions (verified against live fixture 2026-04-30):
 * - Timestamps: created_on / modified_on (NOT created_at / updated_at)
 * - Currency amounts: FLOAT (z.number()) in VND — Sapo serializes 150000.0000
 * - Both sub_total_price AND subtotal_price present (Sapo quirk — two spellings)
 * - cancel_reason: null allowed
 * - financial_status: "pending" in live fixture
 * - fulfillment_status: "fulfilled" in live fixture; null allowed
 * - status: "open" in live fixture
 * - test: boolean sandbox marker
 * - payment_gateway_names: array of strings (can be empty)
 * - billing_address / shipping_address use VN fields (province, district, ward)
 */

import { z } from 'zod';
import { CustomerSchema } from './customer.js';

// ── Enums ────────────────────────────────────────────────────────────────────

export const OrderFinancialStatusEnum = z.enum([
  'pending',
  'authorized',
  'partially_paid',
  'paid',
  'partially_refunded',
  'refunded',
  'voided',
]);

export const OrderFulfillmentStatusEnum = z
  .enum(['fulfilled', 'partial', 'unfulfilled', 'restocked'])
  .nullable();

export const OrderStatusEnum = z.enum(['open', 'closed', 'cancelled', 'any']);

// ── Nested schemas ───────────────────────────────────────────────────────────

/**
 * Line item nested in an order or fulfillment.
 * price / discounted_unit_price / totals are float VND.
 */
const OrderLineItemSchema = z
  .object({
    id: z.number().int(),
    product_id: z.number().int().optional().nullable(),
    variant_id: z.number().int().optional().nullable(),
    inventory_item_id: z.number().int().optional().nullable(),
    name: z.string().optional().nullable(),
    title: z.string().optional().nullable(),
    variant_title: z.string().optional().nullable(),
    sku: z.string().optional().nullable(),
    quantity: z.number().int(),
    price: z.number(), // float VND
    total_discount: z.number().optional(),
    fulfillment_status: z.string().optional().nullable(),
    fulfillable_quantity: z.number().int().optional(),
    grams: z.number().optional(),
    vendor: z.string().optional().nullable(),
    gift_card: z.boolean().optional(),
    taxable: z.boolean().optional(),
    requires_shipping: z.boolean().optional(),
    product_exists: z.boolean().optional(),
    restockable: z.boolean().optional(),
    refundable_quantity: z.number().int().optional(),
    discounted_unit_price: z.number().optional(),
    discounted_total: z.number().optional(),
    original_total: z.number().optional(),
    properties: z.array(z.unknown()).optional(),
    discount_allocations: z.array(z.unknown()).optional(),
    tax_lines: z.array(z.unknown()).optional(),
  })
  .passthrough();

/** Fulfillment line item shape (slightly different from order line item) */
const FulfillmentLineItemSchema = z
  .object({
    id: z.number().int(),
    line_item_id: z.number().int().optional(),
    product_id: z.number().int().optional().nullable(),
    variant_id: z.number().int().optional().nullable(),
    name: z.string().optional().nullable(),
    title: z.string().optional().nullable(),
    quantity: z.number().int(),
    price: z.number(), // float VND
  })
  .passthrough();

/** Embedded fulfillment within an order response */
const EmbeddedFulfillmentSchema = z
  .object({
    id: z.number().int(),
    order_id: z.number().int().optional(),
    status: z.string().optional(),
    tracking_company: z.string().optional().nullable(),
    tracking_number: z.string().optional().nullable(),
    tracking_url: z.string().optional().nullable(),
    tracking_numbers: z.array(z.string()).optional(),
    tracking_urls: z.array(z.string()).optional(),
    line_items: z.array(FulfillmentLineItemSchema).optional(),
    created_on: z.string().optional(),
    modified_on: z.string().optional(),
    notify_customer: z.boolean().optional(),
  })
  .passthrough();

/**
 * Order address schema — similar to AddressSchema but:
 * - id is OPTIONAL (order billing/shipping addresses don't always have id)
 * - Adds province_code, district_code, ward_code, lat/lng
 * - city is optional (addresses on orders may omit it)
 */
const OrderAddressSchema = z
  .object({
    id: z.number().int().optional(),
    first_name: z.string().optional().nullable(),
    last_name: z.string().optional().nullable(),
    name: z.string().optional().nullable(),
    address1: z.string().optional().nullable(),
    address2: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    /** Full Vietnamese province name */
    province: z.string().optional().nullable(),
    province_code: z.string().optional().nullable(),
    /** Vietnamese district name */
    district: z.string().optional().nullable(),
    district_code: z.string().optional().nullable(),
    /** Vietnamese ward name */
    ward: z.string().optional().nullable(),
    ward_code: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
    country_code: z.string().optional().nullable(),
    country_name: z.string().optional().nullable(),
    zip: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    company: z.string().optional().nullable(),
    latitude: z.number().optional().nullable(),
    longitude: z.number().optional().nullable(),
  })
  .passthrough();

const TaxLineSchema = z
  .object({
    price: z.number().optional(),
    rate: z.number().optional(),
    title: z.string().optional(),
  })
  .passthrough();

const ShippingLineSchema = z
  .object({
    id: z.number().int().optional(),
    title: z.string().optional(),
    price: z.number().optional(),
    code: z.string().optional().nullable(),
  })
  .passthrough();

const DiscountCodeSchema = z
  .object({
    code: z.string().optional(),
    amount: z.number().optional(),
    type: z.string().optional(),
  })
  .passthrough();

const DiscountApplicationSchema = z
  .object({
    type: z.string().optional(),
    code: z.string().optional().nullable(),
    title: z.string().optional().nullable(),
    value: z.string().optional(),
    /** "percentage" | "fixed_amount" */
    value_type: z.enum(['percentage', 'fixed_amount']).optional(),
    allocation_method: z.string().optional(),
    target_selection: z.string().optional(),
    target_type: z.string().optional(),
  })
  .passthrough();

// ── Main Order schema ─────────────────────────────────────────────────────────

export const OrderSchema = z
  .object({
    id: z.number().int(),
    name: z.string().optional().nullable(),
    number: z.number().int().optional(),
    order_number: z.number().int().optional(),

    // Core statuses (required fields exposed by tools)
    financial_status: OrderFinancialStatusEnum,
    fulfillment_status: OrderFulfillmentStatusEnum.optional().nullable(),
    status: OrderStatusEnum.optional(),

    // Timestamps — Sapo convention (NOT _at)
    created_on: z.string(),
    modified_on: z.string(),
    confirmed_on: z.string().optional().nullable(),
    processed_on: z.string().optional().nullable(),
    cancelled_on: z.string().optional().nullable(),
    closed_on: z.string().optional().nullable(),
    completed_on: z.string().optional().nullable(),
    delivered_on: z.string().optional().nullable(),

    // Currency & pricing — all float VND (z.number() NOT int)
    currency: z.string(),
    total_price: z.number(),
    total_discounts: z.number().optional(),
    total_line_items_price: z.number().optional(),
    total_tax: z.number().optional(),
    total_weight: z.number().optional(),
    total_shipping_price: z.number().optional(),
    /**
     * Sapo quirk: both spellings present simultaneously.
     * sub_total_price = old API field; subtotal_price = newer alias.
     * Accept both; tools expose subtotal_price.
     */
    subtotal_price: z.number().optional(),
    sub_total_price: z.number().optional(),
    original_total_price: z.number().optional(),
    current_subtotal_price: z.number().optional(),
    current_total_price: z.number().optional(),
    current_total_tax: z.number().optional(),
    net_payment: z.number().optional(),
    total_received: z.number().optional(),
    total_refunded: z.number().optional(),
    total_outstanding: z.number().optional(),
    unpaid_amount: z.number().optional(),

    // Source / channel
    source_name: z.string().optional().nullable(),
    source_category: z.string().optional().nullable(),
    source: z.string().optional().nullable(),
    gateway: z.string().optional().nullable(),
    payment_gateway_names: z.array(z.string()).optional(),
    processing_method: z.string().optional().nullable(),

    // Customer identifiers
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    customer_group_id: z.number().int().optional().nullable(),

    // Misc flags
    /** Sandbox order marker */
    test: z.boolean().optional(),
    buyer_accepts_marketing: z.boolean().optional(),
    tax_exempt: z.boolean().optional(),
    taxes_included: z.boolean().optional(),
    can_mark_as_paid: z.boolean().optional(),
    capturable: z.boolean().optional(),
    refundable: z.boolean().optional(),
    preorder: z.boolean().optional(),
    edited: z.boolean().optional(),

    // Cancellation
    cancel_reason: z.string().optional().nullable(),
    return_status: z.string().optional().nullable(),
    issue_status: z.string().optional().nullable(),

    // Metadata
    tags: z.string().optional().nullable(),
    note: z.string().optional().nullable(),
    token: z.string().optional().nullable(),
    cart_token: z.string().optional().nullable(),
    checkout_token: z.string().optional().nullable(),

    // Location / assignment
    location_id: z.number().int().optional().nullable(),
    user_id: z.number().int().optional().nullable(),
    assignee_id: z.number().int().optional().nullable(),

    // Nested objects
    billing_address: OrderAddressSchema.optional().nullable(),
    shipping_address: OrderAddressSchema.optional().nullable(),
    customer: CustomerSchema.optional().nullable(),
    line_items: z.array(OrderLineItemSchema),
    shipping_lines: z.array(ShippingLineSchema).optional(),
    tax_lines: z.array(TaxLineSchema).optional(),
    discount_codes: z.array(DiscountCodeSchema).optional(),
    discount_applications: z.array(DiscountApplicationSchema).optional(),
    fulfillments: z.array(EmbeddedFulfillmentSchema).optional(),
    refunds: z.array(z.unknown()).optional(),
    note_attributes: z.array(z.unknown()).optional(),
  })
  .passthrough();

export type Order = z.infer<typeof OrderSchema>;

export const OrderSingleResponseSchema = z.object({ order: OrderSchema }).passthrough();
export type OrderSingleResponse = z.infer<typeof OrderSingleResponseSchema>;

export const OrderListResponseSchema = z.object({ orders: z.array(OrderSchema) }).passthrough();
export type OrderListResponse = z.infer<typeof OrderListResponseSchema>;
