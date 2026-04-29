/**
 * Order read tools for pos-online mode.
 * Registers: list_orders, get_order, count_orders, search_orders
 *
 * Sapo endpoints:
 *   GET /admin/orders.json
 *   GET /admin/orders/{id}.json
 *   GET /admin/orders/count.json
 *   Search via list with name=, email=, phone= filter params
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

export function registerOrderTools(server: McpServer, client: SapoClient): void {
  // ── list_orders ─────────────────────────────────────────────────────────────
  server.registerTool(
    'list_orders',
    {
      description:
        'List orders with optional filters. Returns paginated results via since_id cursor. Filter by status, financial_status, fulfillment_status, or source_name (facebook, web, pos). If has_more=true, call again with next_since_id.',
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
          .describe('Filter by order status: open, closed, cancelled, any (default: open).'),
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
          .describe('Filter by payment/financial status.'),
        fulfillment_status: z
          .enum(['fulfilled', 'partial', 'unfulfilled', 'restocked'])
          .optional()
          .describe('Filter by fulfillment status.'),
        created_on_min: z.string().optional().describe('Filter by created date min (ISO 8601).'),
        created_on_max: z.string().optional().describe('Filter by created date max (ISO 8601).'),
        source_name: z
          .string()
          .optional()
          .describe(
            'Filter by order source channel e.g. "facebook", "web", "pos", "bizweb_draft_order".',
          ),
      },
    },
    async (args) => {
      const limit = args.limit ?? 50;
      const params: Record<string, string | number | boolean | undefined> = { limit };
      if (args.since_id !== undefined) params.since_id = args.since_id;
      if (args.status) params.status = args.status;
      if (args.financial_status) params.financial_status = args.financial_status;
      if (args.fulfillment_status) params.fulfillment_status = args.fulfillment_status;
      if (args.created_on_min) params.created_on_min = args.created_on_min;
      if (args.created_on_max) params.created_on_max = args.created_on_max;
      if (args.source_name) params.source_name = args.source_name;

      const raw = await client.get('/orders.json', { params });
      const parsed = OrderListResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: orders list');
      const envelope = buildEnvelope(parsed.data.orders, limit);
      return okResponse(envelope);
    },
  );

  // ── get_order ───────────────────────────────────────────────────────────────
  server.registerTool(
    'get_order',
    {
      description:
        'Get a single order by ID. Returns full order including line_items, fulfillments, customer, billing/shipping address, and financial details.',
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

  // ── count_orders ─────────────────────────────────────────────────────────────
  server.registerTool(
    'count_orders',
    {
      description:
        'Count total orders, optionally filtered by status, financial_status, or date range. Returns { count: N }.',
      inputSchema: {
        status: z
          .enum(['open', 'closed', 'cancelled', 'any'])
          .optional()
          .describe('Filter count by order status.'),
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
          .describe('Filter count by financial status.'),
        created_on_min: z.string().optional().describe('Filter by created date min (ISO 8601).'),
        created_on_max: z.string().optional().describe('Filter by created date max (ISO 8601).'),
      },
    },
    async (args) => {
      const params: Record<string, string | number | boolean | undefined> = {};
      if (args.status) params.status = args.status;
      if (args.financial_status) params.financial_status = args.financial_status;
      if (args.created_on_min) params.created_on_min = args.created_on_min;
      if (args.created_on_max) params.created_on_max = args.created_on_max;

      const raw = await client.get('/orders/count.json', { params });
      return okResponse(raw);
    },
  );

  // ── search_orders ────────────────────────────────────────────────────────────
  server.registerTool(
    'search_orders',
    {
      description:
        'Search orders by name (order #), customer email, or customer phone. Uses filter params on the orders list endpoint. Returns paginated results.',
      inputSchema: {
        name: z
          .string()
          .optional()
          .describe('Order name / number to search e.g. "#1001" or "1001".'),
        email: z.string().optional().describe('Customer email address to filter orders by.'),
        phone: z.string().optional().describe('Customer phone number to filter orders by.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(250)
          .optional()
          .describe('Max results per page (default 50, max 250).'),
      },
    },
    async (args) => {
      const limit = args.limit ?? 50;
      const params: Record<string, string | number | boolean | undefined> = { limit };
      if (args.name) params.name = args.name;
      if (args.email) params.email = args.email;
      if (args.phone) params.phone = args.phone;

      const raw = await client.get('/orders.json', { params });
      const parsed = OrderListResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: order search');
      const envelope = buildEnvelope(parsed.data.orders, limit);
      return okResponse(envelope);
    },
  );
}
