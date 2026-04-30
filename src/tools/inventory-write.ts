/**
 * Inventory write tools for pos-counter mode.
 * Registers:
 *   adjust_inventory_level  — POST /admin/inventory_levels/adjust.json  [safe write]
 *   set_inventory_level     — POST /admin/inventory_levels/set.json      [destructive: inventory_set]
 *   connect_inventory_level — POST /admin/inventory_levels/connect.json  [safe write]
 *
 * set_inventory_level is gated by SAPO_ALLOW_OPS=inventory_set because it overwrites
 * absolute quantity and cannot be undone without knowing the previous value.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import type { GuardContext } from '../guards.js';
import { registerIfAllowed } from '../guards.js';
import { okResponse } from './tool-response.js';

export function registerInventoryWriteTools(
  server: McpServer,
  client: SapoClient,
  ctx: GuardContext,
): void {
  // ── adjust_inventory_level ───────────────────────────────────────────────────
  server.registerTool(
    'adjust_inventory_level',
    {
      description:
        'Adjust inventory level by a relative delta (positive = receive stock, negative = remove stock). For inventory managers — use for stock receipts and corrections. Delta is applied atomically.',
      inputSchema: {
        location_id: z.number().int().describe('Location ID to adjust inventory at. Required.'),
        inventory_item_id: z
          .number()
          .int()
          .describe('Inventory item ID (equals variant_id in Sapo). Required.'),
        available_adjustment: z
          .number()
          .int()
          .describe(
            'Relative adjustment to available quantity. Positive adds stock, negative removes. Required.',
          ),
      },
    },
    async (args) => {
      const body = {
        location_id: args.location_id,
        inventory_item_id: args.inventory_item_id,
        available_adjustment: args.available_adjustment,
      };
      const raw = await client.post('/inventory_levels/adjust.json', body);
      return okResponse(raw);
    },
  );

  // ── set_inventory_level ──────────────────────────────────────────────────────
  // Destructive: overwrites absolute quantity. Requires SAPO_ALLOW_OPS=inventory_set.
  registerIfAllowed(
    server,
    {
      name: 'set_inventory_level',
      category: 'inventory_set',
      description:
        '[DESTRUCTIVE: inventory_set] Set inventory level to an absolute quantity, overwriting the current value. Cannot be undone without knowing the previous quantity. For inventory managers — use only during physical stock counts. Requires SAPO_ALLOW_OPS=inventory_set AND confirm:true.',
      inputSchema: {
        confirm: z
          .literal(true)
          .describe('Must be true. Explicit confirmation required for destructive operations.'),
        location_id: z.number().int().describe('Location ID to set inventory at. Required.'),
        inventory_item_id: z
          .number()
          .int()
          .describe('Inventory item ID (equals variant_id in Sapo). Required.'),
        available: z
          .number()
          .int()
          .min(0)
          .describe('Absolute available quantity to set. Must be non-negative. Required.'),
      },
      handler: async (args) => {
        const body = {
          location_id: args.location_id,
          inventory_item_id: args.inventory_item_id,
          available: args.available,
        };
        const raw = await client.post('/inventory_levels/set.json', body);
        return okResponse(raw);
      },
    },
    ctx,
  );

  // ── connect_inventory_level ──────────────────────────────────────────────────
  server.registerTool(
    'connect_inventory_level',
    {
      description:
        'Connect an inventory item to a location (enable tracking at that location). For store owners — run once per item per location to activate inventory tracking.',
      inputSchema: {
        location_id: z
          .number()
          .int()
          .describe('Location ID to connect the inventory item to. Required.'),
        inventory_item_id: z
          .number()
          .int()
          .describe('Inventory item ID to connect (equals variant_id). Required.'),
        relocate_if_necessary: z
          .boolean()
          .optional()
          .describe(
            'If true, Sapo will deactivate the item at its current location and activate it here.',
          ),
      },
    },
    async (args) => {
      const body: Record<string, unknown> = {
        location_id: args.location_id,
        inventory_item_id: args.inventory_item_id,
      };
      if (args.relocate_if_necessary !== undefined) {
        body.relocate_if_necessary = args.relocate_if_necessary;
      }
      const raw = await client.post('/inventory_levels/connect.json', body);
      return okResponse(raw);
    },
  );
}
