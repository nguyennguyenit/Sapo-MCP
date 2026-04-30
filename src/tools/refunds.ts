/**
 * Refund tools for pos-online mode.
 * Replaces deprecated order_returns tools (Sapo admin UI does NOT use /admin/order_returns
 * — it uses /admin/orders/{id}/refunds for all return/refund flows).
 *
 * Registers:
 *   list_refunds   — GET  /admin/orders/{order_id}/refunds.json                  [read]
 *   get_refund     — GET  /admin/orders/{order_id}/refunds/{refund_id}.json      [read]
 *   create_refund  — POST /admin/orders/{order_id}/refunds.json                  [destructive: refund]
 *
 * Notes:
 * - Refunds CANNOT be deleted or cancelled (Sapo returns 405 on DELETE).
 * - Refund amount must be ≤ net payment received (Sapo enforces with 422).
 * - POST with `transactions:[]` creates a "ghost" refund — line items recorded,
 *   no money moved, Sapo auto-adds order_adjustment kind=refund_discrepancy.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import type { GuardContext } from '../guards.js';
import { registerIfAllowed } from '../guards.js';
import { RefundListResponseSchema, RefundSingleResponseSchema } from '../schemas/refund.js';
import { errResponse, handleNotFound, okResponse } from './tool-response.js';

export function registerRefundTools(
  server: McpServer,
  client: SapoClient,
  ctx: GuardContext,
): void {
  // ── list_refunds ─────────────────────────────────────────────────────────────
  server.registerTool(
    'list_refunds',
    {
      description:
        'List refunds for a specific order. Returns full refund records with associated transactions, refund line items, and order adjustments.',
      inputSchema: {
        order_id: z.number().int().describe('Order ID to list refunds for. Required.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const raw = await client.get(`/orders/${args.order_id}/refunds.json`);
        const parsed = RefundListResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: refunds list');
        return okResponse({ data: parsed.data.refunds });
      }, 'Order');
    },
  );

  // ── get_refund ───────────────────────────────────────────────────────────────
  server.registerTool(
    'get_refund',
    {
      description: 'Get a single refund by ID. Returns full refund record.',
      inputSchema: {
        order_id: z.number().int().describe('Order ID containing the refund. Required.'),
        refund_id: z.number().int().describe('Refund ID. Required.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const raw = await client.get(`/orders/${args.order_id}/refunds/${args.refund_id}.json`);
        const parsed = RefundSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: refund');
        return okResponse(parsed.data.refund);
      }, 'Refund');
    },
  );

  // ── create_refund ────────────────────────────────────────────────────────────
  registerIfAllowed(
    server,
    {
      name: 'create_refund',
      category: 'refund',
      description:
        '[DESTRUCTIVE: refund] Create a refund for an order. At least one of refund_line_items, order_adjustments, or transactions must be provided. Refund is IRREVERSIBLE (Sapo does not support delete/cancel). Refund amount must be ≤ net payment. Requires SAPO_ALLOW_OPS=refund AND confirm:true.',
      inputSchema: {
        confirm: z
          .literal(true)
          .describe('Must be true. Explicit confirmation required for destructive operations.'),
        order_id: z.number().int().describe('Order ID to refund. Required.'),
        refund_line_items: z
          .array(
            z.object({
              line_item_id: z.number().int().describe('Order line item ID to refund.'),
              quantity: z.number().int().describe('Quantity to refund.'),
              location_id: z
                .number()
                .int()
                .optional()
                .describe('Location ID for restock (defaults to order location).'),
              restock_type: z
                .enum(['no_restock', 'return', 'cancel'])
                .optional()
                .describe('Restock behavior: no_restock | return | cancel.'),
            }),
          )
          .optional()
          .describe(
            'Line items to record in refund. Provide at least one of refund_line_items / order_adjustments / transactions.',
          ),
        transactions: z
          .array(
            z.object({
              parent_id: z.number().int().describe('Parent transaction ID (the original sale).'),
              amount: z
                .number()
                .describe('Amount to refund (float VND). Must be ≤ net payment received.'),
              kind: z.literal('refund').describe('Always "refund".'),
              gateway: z.string().describe('Payment gateway name (e.g. "manual", "Tiền mặt").'),
            }),
          )
          .optional()
          .describe(
            'Refund transactions. Omit or pass [] to create a "ghost" refund without moving money.',
          ),
        note: z.string().optional().describe('Internal note for the refund.'),
        notify: z.boolean().optional().describe('Whether to notify customer via email.'),
        restock: z
          .boolean()
          .optional()
          .describe('Whether to restock returned items. Per-line restock_type takes precedence.'),
      },
      handler: async (args) => {
        return handleNotFound(async () => {
          const refund: Record<string, unknown> = {};
          if (args.refund_line_items !== undefined)
            refund.refund_line_items = args.refund_line_items;
          if (args.transactions !== undefined) refund.transactions = args.transactions;
          if (args.note !== undefined) refund.note = args.note;
          if (args.notify !== undefined) refund.notify = args.notify;
          if (args.restock !== undefined) refund.restock = args.restock;

          const raw = await client.post(`/orders/${args.order_id}/refunds.json`, { refund });
          const parsed = RefundSingleResponseSchema.safeParse(raw);
          if (!parsed.success) return errResponse('Invalid response from Sapo API: create refund');
          return okResponse(parsed.data.refund);
        }, 'Order');
      },
    },
    ctx,
  );
}
