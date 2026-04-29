/**
 * Customer read tools for pos-online mode.
 * Registers: list_customers, get_customer, search_customers,
 *            count_customers, list_customer_orders
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import { CustomerListResponseSchema, CustomerSingleResponseSchema } from '../schemas/customer.js';
import { errResponse, handleNotFound, okResponse } from './tool-response.js';

/** Pagination envelope returned for list tools */
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

export function registerCustomerTools(server: McpServer, client: SapoClient): void {
  // ── list_customers ──────────────────────────────────────────────────────────
  server.registerTool(
    'list_customers',
    {
      description:
        'List customers with optional filters. Returns paginated results via since_id cursor. If has_more=true, call again with next_since_id.',
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
          .describe('Return customers with ID greater than this value (cursor pagination).'),
        created_on_min: z.string().optional().describe('Filter by created date min (ISO 8601).'),
        created_on_max: z.string().optional().describe('Filter by created date max (ISO 8601).'),
        modified_on_min: z.string().optional().describe('Filter by modified date min (ISO 8601).'),
        modified_on_max: z.string().optional().describe('Filter by modified date max (ISO 8601).'),
      },
    },
    async (args) => {
      const limit = args.limit ?? 50;
      const params: Record<string, string | number | boolean | undefined> = { limit };
      if (args.since_id !== undefined) params.since_id = args.since_id;
      if (args.created_on_min) params.created_on_min = args.created_on_min;
      if (args.created_on_max) params.created_on_max = args.created_on_max;
      if (args.modified_on_min) params.modified_on_min = args.modified_on_min;
      if (args.modified_on_max) params.modified_on_max = args.modified_on_max;

      const raw = await client.get('/customers.json', { params });
      const parsed = CustomerListResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: customers list');
      const envelope = buildEnvelope(parsed.data.customers, limit);
      return okResponse(envelope);
    },
  );

  // ── get_customer ────────────────────────────────────────────────────────────
  server.registerTool(
    'get_customer',
    {
      description: 'Get a single customer by ID, including their address list and order count.',
      inputSchema: {
        customer_id: z.number().int().describe('Customer ID (numeric). Required.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const raw = await client.get(`/customers/${args.customer_id}.json`);
        const parsed = CustomerSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: customer');
        return okResponse(parsed.data.customer);
      }, 'Customer');
    },
  );

  // ── search_customers ────────────────────────────────────────────────────────
  server.registerTool(
    'search_customers',
    {
      description:
        'Search customers by query string (matches email, phone, name). Returns paginated list.',
      inputSchema: {
        query: z.string().describe('Search term: email address, phone number, or name fragment.'),
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
      const raw = await client.get('/customers/search.json', {
        params: { query: args.query, limit },
      });
      const parsed = CustomerListResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: customer search');
      const envelope = buildEnvelope(parsed.data.customers, limit);
      return okResponse(envelope);
    },
  );

  // ── count_customers ─────────────────────────────────────────────────────────
  server.registerTool(
    'count_customers',
    {
      description: 'Count total customers in the store, optionally filtered by creation date.',
      inputSchema: {
        created_on_min: z.string().optional().describe('Filter by created date min (ISO 8601).'),
        created_on_max: z.string().optional().describe('Filter by created date max (ISO 8601).'),
      },
    },
    async (args) => {
      const params: Record<string, string | number | boolean | undefined> = {};
      if (args.created_on_min) params.created_on_min = args.created_on_min;
      if (args.created_on_max) params.created_on_max = args.created_on_max;
      const raw = await client.get('/customers/count.json', { params });
      return okResponse(raw);
    },
  );

  // ── list_customer_orders ────────────────────────────────────────────────────
  server.registerTool(
    'list_customer_orders',
    {
      description:
        'List all orders placed by a specific customer. Returns paginated results via since_id cursor.',
      inputSchema: {
        customer_id: z.number().int().describe('Customer ID whose orders to list. Required.'),
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
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const limit = args.limit ?? 50;
        const params: Record<string, string | number | boolean | undefined> = { limit };
        if (args.since_id !== undefined) params.since_id = args.since_id;

        const raw = await client.get(`/customers/${args.customer_id}/orders.json`, { params });
        // Orders response: { orders: [...] }
        const orders = (raw as Record<string, unknown>).orders ?? [];
        const items = orders as Array<{ id: number }>;
        const envelope = buildEnvelope(items, limit);
        return okResponse(envelope);
      }, 'Customer');
    },
  );
}
