/**
 * Location tools for pos-counter mode.
 * Registers: list_locations, get_location
 *
 * Sapo endpoints:
 *   GET /admin/locations.json
 *   GET /admin/locations/{id}.json
 *
 * Note: /admin/locations.json is UNDOCUMENTED in Sapo official docs.
 * Verified working 2026-04-30.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import { LocationListResponseSchema, LocationSingleResponseSchema } from '../schemas/location.js';
import { errResponse, handleNotFound, okResponse } from './tool-response.js';

export function registerLocationTools(server: McpServer, client: SapoClient): void {
  // ── list_locations ───────────────────────────────────────────────────────────
  server.registerTool(
    'list_locations',
    {
      description:
        '[UNDOCUMENTED endpoint, verified 2026-04-30, schema may change] List all store locations (warehouses, retail counters). For inventory managers — use location_id to filter inventory queries per location.',
      inputSchema: {
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
      const params: Record<string, string | number | boolean | undefined> = {};
      if (args.limit !== undefined) params.limit = args.limit;

      const raw = await client.get('/locations.json', { params });
      const parsed = LocationListResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: locations');
      return okResponse(parsed.data.locations);
    },
  );

  // ── get_location ─────────────────────────────────────────────────────────────
  server.registerTool(
    'get_location',
    {
      description:
        '[UNDOCUMENTED endpoint, verified 2026-04-30, schema may change] Get a single location by ID. Returns address, contact info, and active status.',
      inputSchema: {
        location_id: z.number().int().describe('Location ID (numeric). Required.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const raw = await client.get(`/locations/${args.location_id}.json`);
        const parsed = LocationSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: location');
        return okResponse(parsed.data.location);
      }, 'Location');
    },
  );
}
