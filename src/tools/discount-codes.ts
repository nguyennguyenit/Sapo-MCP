/**
 * Discount code tools for pos-online mode.
 * Registers: list_discount_codes, create_discount_code
 *
 * Sapo endpoints (nested under price_rules):
 *   GET  /admin/price_rules/{price_rule_id}/discount_codes.json
 *   POST /admin/price_rules/{price_rule_id}/discount_codes.json
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import {
  DiscountCodeListResponseSchema,
  DiscountCodeSingleResponseSchema,
} from '../schemas/discount-code.js';
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

export function registerDiscountCodeTools(server: McpServer, client: SapoClient): void {
  // ── list_discount_codes ──────────────────────────────────────────────────────
  server.registerTool(
    'list_discount_codes',
    {
      description:
        'List discount codes for a specific price rule. Returns paginated results via since_id cursor. Must provide price_rule_id.',
      inputSchema: {
        price_rule_id: z
          .number()
          .int()
          .describe('Price rule ID to list discount codes for. Required.'),
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
          .describe('Return codes with ID greater than this value (cursor pagination).'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const limit = args.limit ?? 50;
        const params: Record<string, string | number | boolean | undefined> = { limit };
        if (args.since_id !== undefined) params.since_id = args.since_id;

        const raw = await client.get(`/price_rules/${args.price_rule_id}/discount_codes.json`, {
          params,
        });
        const parsed = DiscountCodeListResponseSchema.safeParse(raw);
        if (!parsed.success)
          return errResponse('Invalid response from Sapo API: discount codes list');
        const envelope = buildEnvelope(parsed.data.discount_codes, limit);
        return okResponse(envelope);
      }, 'PriceRule');
    },
  );

  // ── create_discount_code ─────────────────────────────────────────────────────
  server.registerTool(
    'create_discount_code',
    {
      description:
        'Create a discount code for a price rule. Side effect: creates a DiscountCode that customers can apply at checkout. Code must be unique across the store.',
      inputSchema: {
        price_rule_id: z
          .number()
          .int()
          .describe('Price rule ID to create the discount code under. Required.'),
        code: z
          .string()
          .min(1)
          .describe('Discount code string (e.g. "SUMMER10"). Must be unique. Required.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const raw = await client.post(`/price_rules/${args.price_rule_id}/discount_codes.json`, {
          discount_code: { code: args.code },
        });
        const parsed = DiscountCodeSingleResponseSchema.safeParse(raw);
        if (!parsed.success)
          return errResponse('Invalid response from Sapo API: create discount code');
        return okResponse(parsed.data.discount_code);
      }, 'PriceRule');
    },
  );
}
