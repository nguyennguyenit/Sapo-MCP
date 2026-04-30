/**
 * POS counter order tools — filters orders to POS channel only.
 * Registers: list_pos_orders, get_pos_order
 *
 * Uses /admin/orders.json with source_name=pos filter.
 * Sapo uses "source_name" field to identify order channel (same as Shopify convention).
 *
 * For cashiers — these tools show only orders created at the physical POS counter.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import { OrderListResponseSchema, OrderSingleResponseSchema } from '../schemas/order.js';
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

export function registerOrdersCounterTools(server: McpServer, client: SapoClient): void {
  // ── list_pos_orders ──────────────────────────────────────────────────────────
  server.registerTool(
    'list_pos_orders',
    {
      description:
        'List orders created at the POS counter (source_name=pos). For cashiers — review in-store sales. Returns paginated results via since_id cursor.',
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
          .describe('Return orders with ID greater than this value (cursor pagination).'),
        status: z
          .enum(['open', 'closed', 'cancelled', 'any'])
          .optional()
          .describe('Filter by order status (default: open).'),
        financial_status: z
          .enum([
            'pending',
            'authorized',
            'partially_paid',
            'paid',
            'partially_refunded',
            'refunded',
            'voided',
          ])
          .optional()
          .describe('Filter by payment status.'),
        created_on_min: z.string().optional().describe('Filter by created date min (ISO 8601).'),
        created_on_max: z.string().optional().describe('Filter by created date max (ISO 8601).'),
      },
    },
    async (args) => {
      const limit = args.limit ?? 50;
      const params: Record<string, string | number | boolean | undefined> = {
        limit,
        source_name: 'pos',
      };
      if (args.since_id !== undefined) params.since_id = args.since_id;
      if (args.status) params.status = args.status;
      if (args.financial_status) params.financial_status = args.financial_status;
      if (args.created_on_min) params.created_on_min = args.created_on_min;
      if (args.created_on_max) params.created_on_max = args.created_on_max;

      const raw = await client.get('/orders.json', { params });
      const parsed = OrderListResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: orders');
      const envelope = buildEnvelope(parsed.data.orders, limit);
      return okResponse(envelope);
    },
  );

  // ── get_pos_order ────────────────────────────────────────────────────────────
  server.registerTool(
    'get_pos_order',
    {
      description:
        'Get a single POS order by ID. For cashiers — view full details of an in-store transaction including line items, payment, and fulfillment status.',
      inputSchema: {
        order_id: z.number().int().describe('Order ID (numeric). Required.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const raw = await client.get(`/orders/${args.order_id}.json`);
        const parsed = OrderSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: order');
        return okResponse(parsed.data.order);
      }, 'Order');
    },
  );
}
