/**
 * StockTransferSchema — Sapo Stock Transfer resource.
 *
 * Endpoint: /admin/stock_transfers.json
 * Status: UNDOCUMENTED in Sapo official docs. Verified working 2026-04-30.
 *
 * Stub fixture — replace with real capture from `npm run capture:fixtures` before 0.2.0 publish.
 * Uses .passthrough() — only id/status/timestamps validated.
 */

import { z } from 'zod';

export const StockTransferSchema = z
  .object({
    id: z.number().int(),
    status: z.string().optional(),
    from_location_id: z.number().int().nullable().optional(),
    to_location_id: z.number().int().nullable().optional(),
    note: z.string().nullable().optional(),
    created_on: z.string().optional(),
    modified_on: z.string().optional(),
  })
  .passthrough();

export type StockTransfer = z.infer<typeof StockTransferSchema>;

export const StockTransferSingleResponseSchema = z
  .object({ stock_transfer: StockTransferSchema })
  .passthrough();

export type StockTransferSingleResponse = z.infer<typeof StockTransferSingleResponseSchema>;

export const StockTransferListResponseSchema = z
  .object({ stock_transfers: z.array(StockTransferSchema) })
  .passthrough();

export type StockTransferListResponse = z.infer<typeof StockTransferListResponseSchema>;
