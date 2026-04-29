/**
 * Price rule tools for pos-online mode.
 * Registers: list_price_rules, get_price_rule, create_price_rule, update_price_rule
 *
 * Sapo endpoints:
 *   GET  /admin/price_rules.json
 *   GET  /admin/price_rules/{id}.json
 *   POST /admin/price_rules.json
 *   PUT  /admin/price_rules/{id}.json
 *
 * Note: value field is a STRING in Sapo (e.g. "-10.0"), not a number.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import {
  PriceRuleListResponseSchema,
  PriceRuleSingleResponseSchema,
} from '../schemas/price-rule.js';
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

export function registerPriceRuleTools(server: McpServer, client: SapoClient): void {
  // ── list_price_rules ─────────────────────────────────────────────────────────
  server.registerTool(
    'list_price_rules',
    {
      description:
        'List price rules (discount rules) with optional filters. Returns paginated results via since_id cursor. Filter by status (active, archived, scheduled).',
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
          .describe('Return price rules with ID greater than this value (cursor pagination).'),
        status: z
          .enum(['active', 'archived', 'scheduled'])
          .optional()
          .describe('Filter by price rule status.'),
      },
    },
    async (args) => {
      const limit = args.limit ?? 50;
      const params: Record<string, string | number | boolean | undefined> = { limit };
      if (args.since_id !== undefined) params.since_id = args.since_id;
      if (args.status) params.status = args.status;

      const raw = await client.get('/price_rules.json', { params });
      const parsed = PriceRuleListResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: price rules list');
      const envelope = buildEnvelope(parsed.data.price_rules, limit);
      return okResponse(envelope);
    },
  );

  // ── get_price_rule ───────────────────────────────────────────────────────────
  server.registerTool(
    'get_price_rule',
    {
      description:
        'Get a single price rule by ID. Returns full price rule including value_type, value (string), entitled/prerequisite IDs, and usage stats.',
      inputSchema: {
        price_rule_id: z.number().int().describe('Price rule ID (numeric). Required.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const raw = await client.get(`/price_rules/${args.price_rule_id}.json`);
        const parsed = PriceRuleSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: price rule');
        return okResponse(parsed.data.price_rule);
      }, 'PriceRule');
    },
  );

  // ── create_price_rule ────────────────────────────────────────────────────────
  server.registerTool(
    'create_price_rule',
    {
      description:
        'Create a new price rule (discount rule). Side effect: creates a PriceRule record. value must be a STRING (e.g. "-10.0" for 10% off). title, value_type, value, target_type, allocation_method, customer_selection, target_selection are required.',
      inputSchema: {
        title: z.string().describe('Price rule display title. Required.'),
        value_type: z
          .enum(['percentage', 'fixed_amount', 'shipping'])
          .describe('Type of discount: percentage, fixed_amount, or shipping. Required.'),
        value: z
          .string()
          .describe(
            'Discount value as string — negative for discount (e.g. "-10.0" = 10% off). Required.',
          ),
        target_type: z
          .enum(['line_item', 'shipping_line'])
          .describe('What the discount applies to. Required.'),
        target_selection: z
          .enum(['all', 'entitled'])
          .describe('Which items are targeted: all or entitled only. Required.'),
        allocation_method: z
          .enum(['across', 'each'])
          .describe('How discount is allocated across items. Required.'),
        customer_selection: z
          .enum(['all', 'prerequisite'])
          .describe('Which customers qualify: all or those meeting prerequisites. Required.'),
        starts_on: z
          .string()
          .optional()
          .describe('Start date (ISO 8601). If omitted, rule is immediately active.'),
        ends_on: z
          .string()
          .optional()
          .nullable()
          .describe('End date (ISO 8601). null = no expiry.'),
        usage_limit: z
          .number()
          .int()
          .optional()
          .nullable()
          .describe('Max total uses. null = unlimited.'),
        once_per_customer: z.boolean().optional().describe('Limit to one use per customer.'),
      },
    },
    async (args) => {
      const price_rule: Record<string, unknown> = {
        title: args.title,
        value_type: args.value_type,
        value: args.value,
        target_type: args.target_type,
        target_selection: args.target_selection,
        allocation_method: args.allocation_method,
        customer_selection: args.customer_selection,
      };
      if (args.starts_on !== undefined) price_rule.starts_on = args.starts_on;
      if (args.ends_on !== undefined) price_rule.ends_on = args.ends_on;
      if (args.usage_limit !== undefined) price_rule.usage_limit = args.usage_limit;
      if (args.once_per_customer !== undefined)
        price_rule.once_per_customer = args.once_per_customer;

      const raw = await client.post('/price_rules.json', { price_rule });
      const parsed = PriceRuleSingleResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: create price rule');
      return okResponse(parsed.data.price_rule);
    },
  );

  // ── update_price_rule ────────────────────────────────────────────────────────
  server.registerTool(
    'update_price_rule',
    {
      description:
        'Update an existing price rule. Side effect: modifies the price rule. Only provided fields are updated. value must remain a string if updating.',
      inputSchema: {
        price_rule_id: z.number().int().describe('Price rule ID to update. Required.'),
        title: z.string().optional().describe('Updated price rule title.'),
        value: z.string().optional().describe('Updated discount value as string (e.g. "-15.0").'),
        starts_on: z.string().optional().describe('Updated start date (ISO 8601).'),
        ends_on: z
          .string()
          .optional()
          .nullable()
          .describe('Updated end date. null = remove expiry.'),
        usage_limit: z.number().int().optional().nullable().describe('Updated usage limit.'),
        once_per_customer: z.boolean().optional().describe('Updated per-customer limit.'),
        status: z.enum(['active', 'archived', 'scheduled']).optional().describe('Updated status.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const { price_rule_id, ...rest } = args;
        const price_rule: Record<string, unknown> = {};
        if (rest.title !== undefined) price_rule.title = rest.title;
        if (rest.value !== undefined) price_rule.value = rest.value;
        if (rest.starts_on !== undefined) price_rule.starts_on = rest.starts_on;
        if (rest.ends_on !== undefined) price_rule.ends_on = rest.ends_on;
        if (rest.usage_limit !== undefined) price_rule.usage_limit = rest.usage_limit;
        if (rest.once_per_customer !== undefined)
          price_rule.once_per_customer = rest.once_per_customer;
        if (rest.status !== undefined) price_rule.status = rest.status;

        const raw = await client.put(`/price_rules/${price_rule_id}.json`, { price_rule });
        const parsed = PriceRuleSingleResponseSchema.safeParse(raw);
        if (!parsed.success)
          return errResponse('Invalid response from Sapo API: update price rule');
        return okResponse(parsed.data.price_rule);
      }, 'PriceRule');
    },
  );
}
