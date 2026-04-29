/**
 * TransactionSchema — Sapo Transaction resource.
 *
 * Verified against live fixture 2026-04-30:
 * - Timestamp: created_on (NOT created_at)
 * - amount: float VND (z.number())
 * - kind: "sale" in live fixture
 * - status: "pending" in live fixture
 * - processed_at: present in live fixture (Sapo exception — uses _at for processed)
 * - test: boolean sandbox marker
 */

import { z } from 'zod';

export const TransactionKindEnum = z.enum(['authorization', 'capture', 'sale', 'void', 'refund']);

export const TransactionStatusEnum = z.enum(['pending', 'success', 'failure', 'error']);

export const TransactionSchema = z
  .object({
    id: z.number().int(),
    order_id: z.number().int(),
    parent_id: z.number().int().optional().nullable(),
    kind: TransactionKindEnum,
    status: TransactionStatusEnum,
    /** Amount in float VND */
    amount: z.number(),
    currency: z.string(),
    gateway: z.string().optional().nullable(),
    // Timestamp: Sapo uses created_on
    created_on: z.string(),
    /**
     * processed_at: Sapo exception — this field uses _at not _on.
     * Observed in live fixture as "processed_at".
     */
    processed_at: z.string().optional().nullable(),
    location_id: z.number().int().optional().nullable(),
    user_id: z.number().int().optional().nullable(),
    source_name: z.string().optional().nullable(),
    authorization: z.string().optional().nullable(),
    error_code: z.string().optional().nullable(),
    message: z.string().optional().nullable(),
    /** Sandbox transaction marker */
    test: z.boolean().optional(),
    refund_id: z.number().int().optional().nullable(),
    checkout_token: z.string().optional().nullable(),
    cause_type: z.string().optional().nullable(),
  })
  .passthrough();

export type Transaction = z.infer<typeof TransactionSchema>;

export const TransactionSingleResponseSchema = z
  .object({ transaction: TransactionSchema })
  .passthrough();
export type TransactionSingleResponse = z.infer<typeof TransactionSingleResponseSchema>;

export const TransactionListResponseSchema = z
  .object({ transactions: z.array(TransactionSchema) })
  .passthrough();
export type TransactionListResponse = z.infer<typeof TransactionListResponseSchema>;
