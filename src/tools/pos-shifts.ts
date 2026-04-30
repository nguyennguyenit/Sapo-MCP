/**
 * POS Shift tools for pos-counter mode.
 * Registers: list_pos_shifts, get_pos_shift
 *
 * Sapo endpoint (canonical): GET /admin/pos_shifts.json
 * Alias also works: /admin/pos/shifts.json
 *
 * Status: UNDOCUMENTED in Sapo official docs. Verified working 2026-04-30.
 * Fixtures: stub — replace with real capture from `npm run capture:fixtures` before 0.2.0 publish.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import { PosShiftListResponseSchema, PosShiftSingleResponseSchema } from '../schemas/pos-shift.js';
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

export function registerPosShiftTools(server: McpServer, client: SapoClient): void {
  // ── list_pos_shifts ──────────────────────────────────────────────────────────
  server.registerTool(
    'list_pos_shifts',
    {
      description:
        '[UNDOCUMENTED endpoint, verified 2026-04-30, schema may change] List POS shifts (cash drawer sessions). For store owners — view opening/closing cash balances per shift. Returns paginated results via since_id cursor.',
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
          .describe('Return shifts with ID greater than this value (cursor pagination).'),
        location_id: z.number().int().optional().describe('Filter shifts by location ID.'),
      },
    },
    async (args) => {
      const limit = args.limit ?? 50;
      const params: Record<string, string | number | boolean | undefined> = { limit };
      if (args.since_id !== undefined) params.since_id = args.since_id;
      if (args.location_id !== undefined) params.location_id = args.location_id;

      const raw = await client.get('/pos_shifts.json', { params });
      const parsed = PosShiftListResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: pos_shifts');
      const envelope = buildEnvelope(parsed.data.pos_shifts, limit);
      return okResponse(envelope);
    },
  );

  // ── get_pos_shift ────────────────────────────────────────────────────────────
  server.registerTool(
    'get_pos_shift',
    {
      description:
        '[UNDOCUMENTED endpoint, verified 2026-04-30, schema may change] Get a single POS shift by ID. Returns opening/closing amounts, status, and timing.',
      inputSchema: {
        shift_id: z.number().int().describe('POS shift ID (numeric). Required.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const raw = await client.get(`/pos_shifts/${args.shift_id}.json`);
        const parsed = PosShiftSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: pos_shift');
        return okResponse(parsed.data.pos_shift);
      }, 'PosShift');
    },
  );
}
