/**
 * Order return tools for pos-online mode.
 * Registers: list_order_returns, get_order_return,
 *            create_order_return, refund_order_return
 *
 * Sapo endpoints:
 *   GET  /admin/order_returns.json
 *   GET  /admin/order_returns/{id}.json
 *   POST /admin/order_returns.json
 *   POST /admin/order_returns/{id}/refund.json
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import {
  OrderReturnListResponseSchema,
  OrderReturnSingleResponseSchema,
} from '../schemas/order-return.js';
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

export function registerOrderReturnTools(server: McpServer, client: SapoClient): void {
  // ── list_order_returns ───────────────────────────────────────────────────────
  server.registerTool(
    'list_order_returns',
    {
      description:
        'List order returns (refund requests) with optional filters. Returns paginated results via since_id cursor. Filter by status or order_id.',
      inputSchema: {
        order_id: z.number().int().optional().describe('Filter returns by specific order ID.'),
        status: z
          .enum(['pending', 'approved', 'refunded', 'cancelled', 'rejected'])
          .optional()
          .describe('Filter by return status.'),
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
          .describe('Return records with ID greater than this value (cursor pagination).'),
      },
    },
    async (args) => {
      const limit = args.limit ?? 50;
      const params: Record<string, string | number | boolean | undefined> = { limit };
      if (args.order_id !== undefined) params.order_id = args.order_id;
      if (args.status) params.status = args.status;
      if (args.since_id !== undefined) params.since_id = args.since_id;

      const raw = await client.get('/order_returns.json', { params });
      const parsed = OrderReturnListResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: order returns list');
      const envelope = buildEnvelope(parsed.data.order_returns, limit);
      return okResponse(envelope);
    },
  );

  // ── get_order_return ─────────────────────────────────────────────────────────
  server.registerTool(
    'get_order_return',
    {
      description:
        'Get a single order return by ID. Returns full return record with line_items, status, and any associated transactions.',
      inputSchema: {
        return_id: z.number().int().describe('Order return ID (numeric). Required.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const raw = await client.get(`/order_returns/${args.return_id}.json`);
        const parsed = OrderReturnSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: order return');
        return okResponse(parsed.data.order_return);
      }, 'OrderReturn');
    },
  );

  // ── create_order_return ──────────────────────────────────────────────────────
  server.registerTool(
    'create_order_return',
    {
      description:
        'Create a return request for an order. Side effect: creates an OrderReturn record in "pending" status. Specify line_items to return and optional restock flag.',
      inputSchema: {
        order_id: z.number().int().describe('Order ID to create return for. Required.'),
        line_items: z
          .array(
            z.object({
              line_item_id: z.number().int().describe('ID of the line item to return.'),
              quantity: z.number().int().describe('Quantity to return.'),
              restock_type: z
                .enum(['return', 'cancel', 'no_restock'])
                .optional()
                .describe('Restock type: return | cancel | no_restock.'),
              location_id: z
                .number()
                .int()
                .optional()
                .describe('Location ID for restocking inventory.'),
            }),
          )
          .describe('Line items to include in the return. Required.'),
        note: z.string().optional().describe('Return reason or customer note.'),
        restock: z
          .boolean()
          .optional()
          .describe('Whether to restock returned items. Defaults to true.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const order_return: Record<string, unknown> = {
          order_id: args.order_id,
          line_items: args.line_items,
        };
        if (args.note !== undefined) order_return.note = args.note;
        if (args.restock !== undefined) order_return.restock = args.restock;

        const raw = await client.post('/order_returns.json', { order_return });
        const parsed = OrderReturnSingleResponseSchema.safeParse(raw);
        if (!parsed.success)
          return errResponse('Invalid response from Sapo API: create order return');
        return okResponse(parsed.data.order_return);
      }, 'Order');
    },
  );

  // ── refund_order_return ──────────────────────────────────────────────────────
  server.registerTool(
    'refund_order_return',
    {
      description:
        'Process a refund for an approved order return. Side effect: triggers refund transaction(s) and marks the OrderReturn as "refunded". Requires return to be in approved status.',
      inputSchema: {
        return_id: z.number().int().describe('Order return ID to refund. Required.'),
        transactions: z
          .array(
            z.object({
              parent_id: z
                .number()
                .int()
                .optional()
                .describe('Parent transaction ID for the refund.'),
              amount: z.number().describe('Refund amount in VND (float).'),
              kind: z
                .enum(['refund'])
                .optional()
                .describe('Transaction kind — always "refund" for this action.'),
              gateway: z.string().optional().describe('Payment gateway to issue refund through.'),
            }),
          )
          .optional()
          .describe('Refund transactions. If omitted, Sapo calculates based on return line_items.'),
        note: z.string().optional().describe('Internal note for the refund action.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const body: Record<string, unknown> = {};
        if (args.transactions) body.transactions = args.transactions;
        if (args.note !== undefined) body.note = args.note;

        const raw = await client.post(`/order_returns/${args.return_id}/refund.json`, body);
        const parsed = OrderReturnSingleResponseSchema.safeParse(raw);
        if (!parsed.success)
          return errResponse('Invalid response from Sapo API: refund order return');
        return okResponse(parsed.data.order_return);
      }, 'OrderReturn');
    },
  );
}
