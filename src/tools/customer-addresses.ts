/**
 * Customer Address read tools for pos-online mode.
 * Registers: list_customer_addresses
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import { AddressListResponseSchema } from '../schemas/address.js';
import { errResponse, handleNotFound, okResponse } from './tool-response.js';

export function registerCustomerAddressTools(server: McpServer, client: SapoClient): void {
  // ── list_customer_addresses ─────────────────────────────────────────────────
  server.registerTool(
    'list_customer_addresses',
    {
      description:
        'List all saved addresses for a customer, including default address flag and Vietnamese province/district/ward fields.',
      inputSchema: {
        customer_id: z.number().int().describe('Customer ID whose addresses to list. Required.'),
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
      return handleNotFound(async () => {
        const params: Record<string, string | number | boolean | undefined> = {};
        if (args.limit !== undefined) params.limit = args.limit;

        const raw = await client.get(`/customers/${args.customer_id}/addresses.json`, { params });
        const parsed = AddressListResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: addresses');
        return okResponse(parsed.data.addresses);
      }, 'Customer');
    },
  );
}
