/**
 * Destructive resource-level tools (delete operations across multiple resources).
 * All tools require SAPO_ALLOW_OPS to include the category AND confirm:true in input.
 *
 * Tools:
 *   delete_price_rule    — DELETE /admin/price_rules/{id}.json              [category: delete]
 *   delete_discount_code — DELETE /admin/price_rules/{pr_id}/discount_codes/{id}.json [category: delete]
 *   delete_customer      — DELETE /admin/customers/{id}.json                [category: delete_strict]
 *   delete_variant       — DELETE /admin/products/{pid}/variants/{id}.json  [category: delete_strict]
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import type { GuardContext } from '../guards.js';
import { registerIfAllowed } from '../guards.js';
import { handleNotFound, okResponse } from './tool-response.js';

export function registerDestructiveResourceTools(
  server: McpServer,
  client: SapoClient,
  ctx: GuardContext,
): void {
  // ── delete_price_rule ─────────────────────────────────────────────────────────
  registerIfAllowed(
    server,
    {
      name: 'delete_price_rule',
      category: 'delete',
      description:
        '[DESTRUCTIVE: delete] Permanently delete a price rule and all its associated discount codes. Cannot be undone. Any active discount codes under this rule stop working immediately. Requires SAPO_ALLOW_OPS=delete AND confirm:true.',
      inputSchema: {
        confirm: z
          .literal(true)
          .describe('Must be true. Explicit confirmation required for destructive operations.'),
        price_rule_id: z.number().int().describe('Price rule ID to delete. Required.'),
      },
      handler: async (args) => {
        return handleNotFound(async () => {
          await client.delete(`/price_rules/${args.price_rule_id}.json`);
          return okResponse({ deleted: true, id: args.price_rule_id });
        }, 'PriceRule');
      },
    },
    ctx,
  );

  // ── delete_discount_code ──────────────────────────────────────────────────────
  registerIfAllowed(
    server,
    {
      name: 'delete_discount_code',
      category: 'delete',
      description:
        '[DESTRUCTIVE: delete] Permanently delete a discount code from a price rule. Cannot be undone. The code immediately stops being valid at checkout. Requires SAPO_ALLOW_OPS=delete AND confirm:true.',
      inputSchema: {
        confirm: z
          .literal(true)
          .describe('Must be true. Explicit confirmation required for destructive operations.'),
        price_rule_id: z
          .number()
          .int()
          .describe('Price rule ID that owns the discount code. Required.'),
        discount_code_id: z.number().int().describe('Discount code ID to delete. Required.'),
      },
      handler: async (args) => {
        return handleNotFound(async () => {
          await client.delete(
            `/price_rules/${args.price_rule_id}/discount_codes/${args.discount_code_id}.json`,
          );
          return okResponse({ deleted: true, id: args.discount_code_id });
        }, 'DiscountCode');
      },
    },
    ctx,
  );

  // ── delete_customer ───────────────────────────────────────────────────────────
  registerIfAllowed(
    server,
    {
      name: 'delete_customer',
      category: 'delete_strict',
      description:
        '[DESTRUCTIVE: delete_strict] Permanently delete a customer record. VERY HARD TO UNDO — customer data and order history links are lost. Customer must have no pending orders. Requires SAPO_ALLOW_OPS=delete_strict AND confirm:true.',
      inputSchema: {
        confirm: z
          .literal(true)
          .describe('Must be true. Explicit confirmation required for destructive operations.'),
        customer_id: z.number().int().describe('Customer ID to permanently delete. Required.'),
      },
      handler: async (args) => {
        return handleNotFound(async () => {
          await client.delete(`/customers/${args.customer_id}.json`);
          return okResponse({ deleted: true, id: args.customer_id });
        }, 'Customer');
      },
    },
    ctx,
  );

  // ── delete_variant ────────────────────────────────────────────────────────────
  registerIfAllowed(
    server,
    {
      name: 'delete_variant',
      category: 'delete_strict',
      description:
        '[DESTRUCTIVE: delete_strict] Permanently delete a product variant. VERY HARD TO UNDO — removes variant and associated inventory records. Cannot delete the last variant of a product (delete the product instead). Requires SAPO_ALLOW_OPS=delete_strict AND confirm:true.',
      inputSchema: {
        confirm: z
          .literal(true)
          .describe('Must be true. Explicit confirmation required for destructive operations.'),
        product_id: z.number().int().describe('Product ID that owns the variant. Required.'),
        variant_id: z.number().int().describe('Variant ID to permanently delete. Required.'),
      },
      handler: async (args) => {
        return handleNotFound(async () => {
          await client.delete(`/products/${args.product_id}/variants/${args.variant_id}.json`);
          return okResponse({ deleted: true, id: args.variant_id });
        }, 'Variant');
      },
    },
    ctx,
  );
}
