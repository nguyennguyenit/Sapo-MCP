/**
 * FulfillmentSchema — Sapo Fulfillment resource.
 *
 * Verified against live fixture 2026-04-30:
 * - Timestamps: created_on / modified_on (NOT _at)
 * - status: "success" in live fixture
 * - tracking_info nested object (carrier, tracking_number, tracking_url, etc.)
 * - tracking_company / tracking_number also at top level (denormalized)
 * - line_items uses FulfillmentLineItem shape
 * - receipt: null or {} (empty object in embedded order fixture)
 * - shipment_status: "pending" in live fixture
 */

import { z } from 'zod';

export const FulfillmentStatusEnum = z.enum([
  'pending',
  'open',
  'success',
  'cancelled',
  'error',
  'failure',
]);

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
    fulfillment_status: z.string().optional().nullable(),
    sku: z.string().optional().nullable(),
    vendor: z.string().optional().nullable(),
    grams: z.number().optional(),
  })
  .passthrough();

const TrackingInfoSchema = z
  .object({
    tracking_company: z.string().optional().nullable(),
    carrier: z.string().optional().nullable(),
    carrier_name: z.string().optional().nullable(),
    tracking_number: z.string().optional().nullable(),
    tracking_url: z.string().optional().nullable(),
    tracking_numbers: z.array(z.string()).optional().nullable(),
    tracking_urls: z.array(z.string()).optional().nullable(),
    reference_status: z.string().optional().nullable(),
    reference_status_explanation: z.string().optional().nullable(),
  })
  .passthrough();

const FulfillmentOriginAddressSchema = z
  .object({
    name: z.string().optional().nullable(),
    address1: z.string().optional().nullable(),
    address2: z.string().optional().nullable(),
    ward: z.string().optional().nullable(),
    ward_code: z.string().optional().nullable(),
    district: z.string().optional().nullable(),
    district_code: z.string().optional().nullable(),
    province: z.string().optional().nullable(),
    province_code: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
    country_code: z.string().optional().nullable(),
  })
  .passthrough();

export const FulfillmentSchema = z
  .object({
    id: z.number().int(),
    order_id: z.number().int(),
    status: FulfillmentStatusEnum,
    // Timestamps — Sapo convention
    created_on: z.string(),
    modified_on: z.string(),
    cancelled_on: z.string().optional().nullable(),
    delivered_on: z.string().optional().nullable(),
    // Tracking — top-level denormalized fields (also in tracking_info)
    tracking_company: z.string().optional().nullable(),
    tracking_number: z.string().optional().nullable(),
    tracking_url: z.string().optional().nullable(),
    tracking_numbers: z.array(z.string()).optional(),
    tracking_urls: z.array(z.string()).optional().nullable(),
    tracking_info: TrackingInfoSchema.optional().nullable(),
    // Nested
    line_items: z.array(FulfillmentLineItemSchema).optional(),
    origin_address: FulfillmentOriginAddressSchema.optional().nullable(),
    // Metadata
    name: z.string().optional().nullable(),
    store_id: z.number().int().optional(),
    location_id: z.number().int().optional().nullable(),
    shipment_status: z.string().optional().nullable(),
    delivery_method: z.string().optional().nullable(),
    notify_customer: z.boolean().optional(),
    receipt: z.unknown().optional().nullable(),
  })
  .passthrough();

export type Fulfillment = z.infer<typeof FulfillmentSchema>;

export const FulfillmentSingleResponseSchema = z
  .object({ fulfillment: FulfillmentSchema })
  .passthrough();
export type FulfillmentSingleResponse = z.infer<typeof FulfillmentSingleResponseSchema>;

export const FulfillmentListResponseSchema = z
  .object({ fulfillments: z.array(FulfillmentSchema) })
  .passthrough();
export type FulfillmentListResponse = z.infer<typeof FulfillmentListResponseSchema>;
