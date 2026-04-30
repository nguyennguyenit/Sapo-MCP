/**
 * Store info tool for web mode.
 * Registers: get_store_info
 *
 * Endpoint: GET /admin/store.json
 * Note: Sapo uses "store" (not "shop" like Shopify).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import { errResponse, okResponse } from './tool-response.js';

// Store schema — passthrough for drift tolerance
const StoreSchema = z
  .object({
    id: z.number().int().optional(),
    name: z.string().optional(),
    email: z.string().optional().nullable(),
    domain: z.string().optional().nullable(),
    province: z.string().optional().nullable(),
    district: z.string().optional().nullable(),
    ward: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    zip: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
    currency: z.string().optional(),
    timezone: z.string().optional().nullable(),
    shop_owner: z.string().optional().nullable(),
    money_format: z.string().optional().nullable(),
    plan_name: z.string().optional().nullable(),
    created_on: z.string().optional(),
    modified_on: z.string().optional(),
  })
  .passthrough();

export function registerStoreInfoTools(server: McpServer, client: SapoClient): void {
  server.registerTool(
    'get_store_info',
    {
      description:
        'Get Sapo store information: name, domain, address, currency, timezone, owner. ' +
        'Useful for SEO/content team to confirm store locale settings and contact details.',
      inputSchema: {},
    },
    async (_args) => {
      const raw = await client.get('/store.json');
      const parsed = StoreSchema.safeParse((raw as Record<string, unknown>).store ?? raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: store info');
      return okResponse(parsed.data);
    },
  );
}
