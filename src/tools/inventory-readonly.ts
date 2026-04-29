/**
 * Inventory Level read-only tools for pos-online mode.
 * Registers: get_inventory_levels
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import { InventoryLevelListResponseSchema } from '../schemas/inventory.js';
import { errResponse, okResponse } from './tool-response.js';

export function registerInventoryReadTools(server: McpServer, client: SapoClient): void {
  // ── get_inventory_levels ────────────────────────────────────────────────────
  server.registerTool(
    'get_inventory_levels',
    {
      description:
        'Get inventory levels (available + committed quantities) for specific variants at specific locations. Filter by location_id, inventory_item_id, or both.',
      inputSchema: {
        location_id: z
          .number()
          .int()
          .optional()
          .describe('Filter by location ID (warehouse/store). Recommended for large catalogs.'),
        inventory_item_id: z
          .number()
          .int()
          .optional()
          .describe('Filter by inventory item ID (equals variant_id in Sapo).'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(250)
          .optional()
          .describe('Max results per page (default 50, max 250).'),
        page: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe('Page number for offset pagination (1-indexed).'),
      },
    },
    async (args) => {
      const params: Record<string, string | number | boolean | undefined> = {};
      if (args.location_id !== undefined) params.location_id = args.location_id;
      if (args.inventory_item_id !== undefined) params.inventory_item_id = args.inventory_item_id;
      if (args.limit !== undefined) params.limit = args.limit;
      if (args.page !== undefined) params.page = args.page;

      const raw = await client.get('/inventory_levels.json', { params });
      const parsed = InventoryLevelListResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: inventory_levels');
      return okResponse(parsed.data.inventory_levels);
    },
  );
}
