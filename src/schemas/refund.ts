/**
 * RefundSchema — Sapo Refund resource.
 *
 * Verified against live fixture 2026-04-30 (store giapducthangscs, order #1001).
 *
 * Endpoint root: /admin/orders/{order_id}/refunds[.json|/{id}.json]
 *
 * Sapo conventions applied:
 * - Timestamps: created_on (Sapo convention) + processed_at (Sapo exception, _at)
 * - Amounts: float VND (z.number())
 * - DELETE not supported (Sapo returns 405) — refunds are immutable once created.
 * - Refund amount must be ≤ net payment received; Sapo enforces with 422.
 * - POST with empty transactions creates a "ghost" refund (line items recorded,
 *   no money moved; Sapo auto-adds order_adjustment kind=refund_discrepancy).
 */

import { z } from 'zod';
import { TransactionSchema } from './transaction.js';

const RefundLineItemSchema = z
  .object({
    id: z.number().int(),
    line_item_id: z.number().int(),
    quantity: z.number().int(),
    location_id: z.number().int().optional().nullable(),
    subtotal: z.number().optional(),
    total_tax: z.number().optional(),
    restock_type: z.enum(['no_restock', 'return', 'cancel']).optional().nullable(),
    total_cart_discount_amount: z.number().optional(),
  })
  .passthrough();

const OrderAdjustmentSchema = z
  .object({
    id: z.number().int(),
    order_id: z.number().int(),
    refund_id: z.number().int().optional().nullable(),
    kind: z.string(),
    reason: z.string().optional().nullable(),
    amount: z.number(),
    tax_amount: z.number().optional(),
  })
  .passthrough();

export const RefundSchema = z
  .object({
    id: z.number().int(),
    order_id: z.number().int(),
    return_id: z.number().int().optional().nullable(),
    created_on: z.string(),
    processed_at: z.string().optional().nullable(),
    restock: z.boolean().optional(),
    user_id: z.number().int().optional().nullable(),
    note: z.string().optional().nullable(),
    transactions: z.array(TransactionSchema).optional(),
    refund_line_items: z.array(RefundLineItemSchema).optional(),
    order_adjustments: z.array(OrderAdjustmentSchema).optional(),
    total_refunded: z.number().optional(),
  })
  .passthrough();

export type Refund = z.infer<typeof RefundSchema>;

export const RefundSingleResponseSchema = z.object({ refund: RefundSchema }).passthrough();
export type RefundSingleResponse = z.infer<typeof RefundSingleResponseSchema>;

export const RefundListResponseSchema = z.object({ refunds: z.array(RefundSchema) }).passthrough();
export type RefundListResponse = z.infer<typeof RefundListResponseSchema>;
