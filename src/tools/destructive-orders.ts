/**
 * Destructive order-related tools (cancel/close operations).
 * All tools require SAPO_ALLOW_OPS to include the category AND confirm:true in input.
 *
 * Tools:
 *   cancel_order         — POST /admin/orders/{id}/cancel.json       [category: cancel]
 *   close_order          — POST /admin/orders/{id}/close.json         [category: cancel]
 *   cancel_fulfillment   — POST /admin/fulfillments/{id}/cancel.json  [category: cancel]
 *   delete_draft_order   — DELETE /admin/draft_orders/{id}.json       [category: delete]
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import type { GuardContext } from '../guards.js';
import { registerIfAllowed } from '../guards.js';
import { handleNotFound, okResponse } from './tool-response.js';

export function registerDestructiveOrderTools(
  server: McpServer,
  client: SapoClient,
  ctx: GuardContext,
): void {
  // ── cancel_order ─────────────────────────────────────────────────────────────
  registerIfAllowed(
    server,
    {
      name: 'cancel_order',
      category: 'cancel',
      description:
        '[DESTRUCTIVE: cancel] Cancel a Sapo order. Sets financial_status to "voided" or "refunded". Cannot cancel an already-cancelled order. Requires SAPO_ALLOW_OPS=cancel AND confirm:true. Use for refund/dispute workflow.',
      inputSchema: {
        confirm: z
          .literal(true)
          .describe('Must be true. Explicit confirmation required for destructive operations.'),
        order_id: z.number().int().describe('Order ID to cancel. Required.'),
        reason: z
          .enum(['customer', 'inventory', 'fraud', 'declined', 'other'])
          .optional()
          .describe('Cancellation reason.'),
        refund: z.boolean().optional().describe('Whether to refund the order upon cancellation.'),
        restock: z.boolean().optional().describe('Whether to restock inventory on cancellation.'),
        email: z.boolean().optional().describe('Whether to send a cancellation email to customer.'),
      },
      handler: async (args) => {
        return handleNotFound(async () => {
          const body: Record<string, unknown> = {};
          if (args.reason !== undefined) body.reason = args.reason;
          if (args.refund !== undefined) body.refund = args.refund;
          if (args.restock !== undefined) body.restock = args.restock;
          if (args.email !== undefined) body.email = args.email;

          const raw = await client.post(`/orders/${args.order_id}/cancel.json`, body);
          // Sapo returns the updated order
          return okResponse(raw);
        }, 'Order');
      },
    },
    ctx,
  );

  // ── close_order ──────────────────────────────────────────────────────────────
  registerIfAllowed(
    server,
    {
      name: 'close_order',
      category: 'cancel',
      description:
        '[DESTRUCTIVE: cancel] Close an order (archive it). Sets order status to "closed". Reversible via reopen, but closes the order from further processing. Requires SAPO_ALLOW_OPS=cancel AND confirm:true.',
      inputSchema: {
        confirm: z
          .literal(true)
          .describe('Must be true. Explicit confirmation required for destructive operations.'),
        order_id: z.number().int().describe('Order ID to close. Required.'),
      },
      handler: async (args) => {
        return handleNotFound(async () => {
          const raw = await client.post(`/orders/${args.order_id}/close.json`, {});
          return okResponse(raw);
        }, 'Order');
      },
    },
    ctx,
  );

  // ── cancel_fulfillment ────────────────────────────────────────────────────────
  registerIfAllowed(
    server,
    {
      name: 'cancel_fulfillment',
      category: 'cancel',
      description:
        '[DESTRUCTIVE: cancel] Cancel a fulfillment. Cancels shipping for a fulfillment that has not yet shipped. Cannot cancel already-shipped fulfillments. Requires SAPO_ALLOW_OPS=cancel AND confirm:true.',
      inputSchema: {
        confirm: z
          .literal(true)
          .describe('Must be true. Explicit confirmation required for destructive operations.'),
        fulfillment_id: z.number().int().describe('Fulfillment ID to cancel. Required.'),
      },
      handler: async (args) => {
        return handleNotFound(async () => {
          const raw = await client.post(`/fulfillments/${args.fulfillment_id}/cancel.json`, {});
          return okResponse(raw);
        }, 'Fulfillment');
      },
    },
    ctx,
  );

  // ── delete_draft_order ────────────────────────────────────────────────────────
  registerIfAllowed(
    server,
    {
      name: 'delete_draft_order',
      category: 'delete',
      description:
        '[DESTRUCTIVE: delete] Permanently delete a draft order. Cannot be undone. Only open draft orders can be deleted — completed drafts cannot be deleted. Requires SAPO_ALLOW_OPS=delete AND confirm:true.',
      inputSchema: {
        confirm: z
          .literal(true)
          .describe('Must be true. Explicit confirmation required for destructive operations.'),
        draft_order_id: z.number().int().describe('Draft order ID to delete. Required.'),
      },
      handler: async (args) => {
        return handleNotFound(async () => {
          await client.delete(`/draft_orders/${args.draft_order_id}.json`);
          return okResponse({ deleted: true, id: args.draft_order_id });
        }, 'DraftOrder');
      },
    },
    ctx,
  );
}
