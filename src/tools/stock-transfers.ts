/**
 * Stock Transfer tools for pos-counter mode.
 * Registers: list_stock_transfers, get_stock_transfer
 *
 * Sapo endpoints:
 *   GET /admin/stock_transfers.json
 *   GET /admin/stock_transfers/{id}.json
 *
 * Status: UNDOCUMENTED in Sapo official docs. Verified working 2026-04-30.
 * Fixtures: stub — replace with real capture from `npm run capture:fixtures` before 0.2.0 publish.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import {
  StockTransferListResponseSchema,
  StockTransferSingleResponseSchema,
} from '../schemas/stock-transfer.js';
import { errResponse, handleNotFound, okResponse } from './tool-response.js';

interface ListEnvelope<T> {
  data: T[];
  has_more: boolean;
  next_since_id: number | null;
}

function buildEnvelope<T extends { id: number }>(items: T[], limit: number): ListEnvelope<T> {
  const has_more = items.length === limit;
  const last = items[items.length - 1];
  return {
    data: items,
    has_more,
    next_since_id: has_more && last ? last.id : null,
  };
}

export function registerStockTransferTools(server: McpServer, client: SapoClient): void {
  // ── list_stock_transfers ─────────────────────────────────────────────────────
  server.registerTool(
    'list_stock_transfers',
    {
      description:
        '[UNDOCUMENTED endpoint, verified 2026-04-30, schema may change] List stock transfers between locations. For inventory managers — track goods movement between warehouses and retail counters. Returns paginated results via since_id cursor.',
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(250)
          .optional()
          .describe('Max results per page (default 50, max 250).'),
        since_id: z
          .number()
          .int()
          .optional()
          .describe('Return transfers with ID greater than this value (cursor pagination).'),
        status: z
          .string()
          .optional()
          .describe('Filter by status (e.g. "pending", "completed", "cancelled").'),
      },
    },
    async (args) => {
      const limit = args.limit ?? 50;
      const params: Record<string, string | number | boolean | undefined> = { limit };
      if (args.since_id !== undefined) params.since_id = args.since_id;
      if (args.status) params.status = args.status;

      const raw = await client.get('/stock_transfers.json', { params });
      const parsed = StockTransferListResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: stock_transfers');
      const envelope = buildEnvelope(parsed.data.stock_transfers, limit);
      return okResponse(envelope);
    },
  );

  // ── get_stock_transfer ───────────────────────────────────────────────────────
  server.registerTool(
    'get_stock_transfer',
    {
      description:
        '[UNDOCUMENTED endpoint, verified 2026-04-30, schema may change] Get a single stock transfer by ID. Returns source/destination locations, status, and line items.',
      inputSchema: {
        transfer_id: z.number().int().describe('Stock transfer ID (numeric). Required.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const raw = await client.get(`/stock_transfers/${args.transfer_id}.json`);
        const parsed = StockTransferSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: stock_transfer');
        return okResponse(parsed.data.stock_transfer);
      }, 'StockTransfer');
    },
  );
}
