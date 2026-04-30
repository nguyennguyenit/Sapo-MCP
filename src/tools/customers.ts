/**
 * Customer tools for pos-online mode.
 * Registers: list_customers, get_customer, search_customers,
 *            count_customers, list_customer_orders,
 *            create_customer, update_customer
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import { CustomerListResponseSchema, CustomerSingleResponseSchema } from '../schemas/customer.js';
import { resolveProvince } from './address-resolver.js';
import { detectLevel2WriteAttempt } from './address-write-validation.js';
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
      const raw = await client.get('/customers.json', {
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

  // ── create_customer ─────────────────────────────────────────────────────────
  const customerInputAddressSchema = z
    .object({
      address1: z.string().describe('Primary address line. Required.'),
      city: z.string().describe('City name. Required.'),
      country: z.string().describe('Country name (e.g. "Vietnam"). Required.'),
      address2: z.string().optional(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      company: z.string().optional(),
      phone: z.string().optional(),
      province: z.string().optional().describe('Vietnamese province name (e.g. "Hà Nội").'),
      province_code: z.string().optional(),
      district: z.string().optional(),
      district_code: z.string().optional(),
      ward: z.string().optional(),
      ward_code: z.string().optional(),
      zip: z.string().optional(),
      country_code: z.string().optional(),
      default: z.boolean().optional(),
    })
    .describe(
      'Address payload. Required: address1, city, country. ' +
        'For subdivision fields: pass BOTH text name AND code together (e.g. province + province_code). ' +
        'Sapo write API only accepts the pre-2025 3-tier schema; the post-2025 2-tier "địa chỉ mới" ' +
        '(province_code 2001+, district_code "-1") is rejected with 422.',
    );

  server.registerTool(
    'create_customer',
    {
      description:
        'Create a new customer. Must provide either email OR phone (or both). ' +
        'Optionally include addresses array for inline address creation. ' +
        'Returns the created customer including auto-generated id.',
      inputSchema: {
        email: z.string().optional().describe('Customer email address.'),
        phone: z.string().optional().describe('Customer phone number (E.164 format recommended).'),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        gender: z.enum(['male', 'female', 'other']).optional(),
        dob: z.string().optional().describe('Birth date in YYYY-MM-DD.'),
        accepts_marketing: z.boolean().optional(),
        verified_email: z.boolean().optional(),
        tags: z.string().optional().describe('Comma-separated tags.'),
        note: z.string().optional(),
        addresses: z
          .array(customerInputAddressSchema)
          .optional()
          .describe('Optional inline addresses to create with the customer.'),
      },
    },
    async (args) => {
      if (!args.email && !args.phone) {
        return errResponse('create_customer requires at least one of: email, phone');
      }
      const resolvedAddresses: typeof args.addresses = args.addresses ? [] : undefined;
      if (args.addresses) {
        for (const [i, addr] of args.addresses.entries()) {
          const err = detectLevel2WriteAttempt(addr);
          if (err) return errResponse(`addresses[${i}]: ${err}`);
          const resolved = await resolveProvince(addr, client);
          if (typeof resolved === 'string') return errResponse(`addresses[${i}]: ${resolved}`);
          resolvedAddresses!.push(
            resolved
              ? { ...addr, province: resolved.province, province_code: resolved.province_code }
              : addr,
          );
        }
      }
      const body: Record<string, unknown> = {};
      if (args.email !== undefined) body.email = args.email;
      if (args.phone !== undefined) body.phone = args.phone;
      if (args.first_name !== undefined) body.first_name = args.first_name;
      if (args.last_name !== undefined) body.last_name = args.last_name;
      if (args.gender !== undefined) body.gender = args.gender;
      if (args.dob !== undefined) body.dob = args.dob;
      if (args.accepts_marketing !== undefined) body.accepts_marketing = args.accepts_marketing;
      if (args.verified_email !== undefined) body.verified_email = args.verified_email;
      if (args.tags !== undefined) body.tags = args.tags;
      if (args.note !== undefined) body.note = args.note;
      if (resolvedAddresses !== undefined) body.addresses = resolvedAddresses;

      const raw = await client.post('/customers.json', { customer: body });
      const parsed = CustomerSingleResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: create customer');
      return okResponse(parsed.data.customer);
    },
  );

  // ── update_customer ─────────────────────────────────────────────────────────
  server.registerTool(
    'update_customer',
    {
      description:
        'Update an existing customer. Only provided fields are modified. ' +
        'Use add_customer_address / update_customer_address tools for address management.',
      inputSchema: {
        customer_id: z.number().int().describe('Customer ID to update. Required.'),
        email: z.string().optional(),
        phone: z.string().optional(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        gender: z.enum(['male', 'female', 'other']).optional(),
        dob: z.string().optional().describe('Birth date in YYYY-MM-DD.'),
        accepts_marketing: z.boolean().optional(),
        verified_email: z.boolean().optional(),
        tags: z.string().optional().describe('Comma-separated tags.'),
        note: z.string().optional(),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const body: Record<string, unknown> = {};
        if (args.email !== undefined) body.email = args.email;
        if (args.phone !== undefined) body.phone = args.phone;
        if (args.first_name !== undefined) body.first_name = args.first_name;
        if (args.last_name !== undefined) body.last_name = args.last_name;
        if (args.gender !== undefined) body.gender = args.gender;
        if (args.dob !== undefined) body.dob = args.dob;
        if (args.accepts_marketing !== undefined) body.accepts_marketing = args.accepts_marketing;
        if (args.verified_email !== undefined) body.verified_email = args.verified_email;
        if (args.tags !== undefined) body.tags = args.tags;
        if (args.note !== undefined) body.note = args.note;

        const raw = await client.put(`/customers/${args.customer_id}.json`, { customer: body });
        const parsed = CustomerSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: update customer');
        return okResponse(parsed.data.customer);
      }, 'Customer');
    },
  );
}
