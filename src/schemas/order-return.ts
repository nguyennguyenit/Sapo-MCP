/**
 * OrderReturnSchema — Sapo Order Return (refund request) resource.
 *
 * Note: Live fixture shows empty array `{ order_returns: [] }` — no real return
 * captured from store. Schema based on researcher-04 spec + Sapo conventions.
 * All non-id fields are optional/nullable to be resilient against drift.
 *
 * Sapo conventions applied:
 * - Timestamps: created_on / modified_on
 * - Amounts: float VND (z.number())
 */

import { z } from 'zod';

export const OrderReturnStatusEnum = z.enum([
  'pending',
  'approved',
  'refunded',
  'cancelled',
  'rejected',
]);

const OrderReturnLineItemSchema = z
  .object({
    id: z.number().int().optional(),
    line_item_id: z.number().int().optional().nullable(),
    quantity: z.number().int().optional(),
    restock_type: z.string().optional().nullable(),
    location_id: z.number().int().optional().nullable(),
    subtotal: z.number().optional(),
    total_tax: z.number().optional(),
  })
  .passthrough();

const OrderReturnTransactionSchema = z
  .object({
    parent_id: z.number().int().optional().nullable(),
    amount: z.number().optional(), // float VND
    kind: z.string().optional(),
    gateway: z.string().optional().nullable(),
  })
  .passthrough();

export const OrderReturnSchema = z
  .object({
    id: z.number().int(),
    order_id: z.number().int(),
    status: OrderReturnStatusEnum.optional().nullable(),
    note: z.string().optional().nullable(),
    // Timestamps — Sapo convention
    created_on: z.string(),
    modified_on: z.string(),
    // Nested
    line_items: z.array(OrderReturnLineItemSchema).optional(),
    transactions: z.array(OrderReturnTransactionSchema).optional(),
    restock: z.boolean().optional(),
    refund_amount: z.number().optional().nullable(), // float VND
  })
  .passthrough();

export type OrderReturn = z.infer<typeof OrderReturnSchema>;

export const OrderReturnSingleResponseSchema = z
  .object({ order_return: OrderReturnSchema })
  .passthrough();
export type OrderReturnSingleResponse = z.infer<typeof OrderReturnSingleResponseSchema>;

export const OrderReturnListResponseSchema = z
  .object({ order_returns: z.array(OrderReturnSchema) })
  .passthrough();
export type OrderReturnListResponse = z.infer<typeof OrderReturnListResponseSchema>;
