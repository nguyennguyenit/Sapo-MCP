/**
 * Supplier tools for pos-counter mode.
 * Registers: list_suppliers, get_supplier
 *
 * Sapo endpoints:
 *   GET /admin/suppliers.json
 *   GET /admin/suppliers/{id}.json
 *
 * Status: UNDOCUMENTED in Sapo official docs. Verified working 2026-04-30.
 * Fixtures: stub — replace with real capture from `npm run capture:fixtures` before 0.2.0 publish.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import { SupplierListResponseSchema, SupplierSingleResponseSchema } from '../schemas/supplier.js';
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

export function registerSupplierTools(server: McpServer, client: SapoClient): void {
  // ── list_suppliers ───────────────────────────────────────────────────────────
  server.registerTool(
    'list_suppliers',
    {
      description:
        '[UNDOCUMENTED endpoint, verified 2026-04-30, schema may change] List suppliers. For inventory managers and store owners — view vendors and supply contacts. Returns paginated results via since_id cursor.',
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
          .describe('Return suppliers with ID greater than this value (cursor pagination).'),
      },
    },
    async (args) => {
      const limit = args.limit ?? 50;
      const params: Record<string, string | number | boolean | undefined> = { limit };
      if (args.since_id !== undefined) params.since_id = args.since_id;

      const raw = await client.get('/suppliers.json', { params });
      const parsed = SupplierListResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: suppliers');
      const envelope = buildEnvelope(parsed.data.suppliers, limit);
      return okResponse(envelope);
    },
  );

  // ── get_supplier ─────────────────────────────────────────────────────────────
  server.registerTool(
    'get_supplier',
    {
      description:
        '[UNDOCUMENTED endpoint, verified 2026-04-30, schema may change] Get a single supplier by ID. Returns contact details and address.',
      inputSchema: {
        supplier_id: z.number().int().describe('Supplier ID (numeric). Required.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const raw = await client.get(`/suppliers/${args.supplier_id}.json`);
        const parsed = SupplierSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: supplier');
        return okResponse(parsed.data.supplier);
      }, 'Supplier');
    },
  );
}
