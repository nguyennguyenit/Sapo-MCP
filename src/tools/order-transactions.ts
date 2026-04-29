/**
 * Order transaction tools for pos-online mode.
 * Registers: list_order_transactions, create_order_transaction
 *
 * Sapo endpoints:
 *   GET  /admin/orders/{order_id}/transactions.json
 *   POST /admin/orders/{order_id}/transactions.json
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import {
  TransactionListResponseSchema,
  TransactionSingleResponseSchema,
} from '../schemas/transaction.js';
import { errResponse, handleNotFound, okResponse } from './tool-response.js';

export function registerOrderTransactionTools(server: McpServer, client: SapoClient): void {
  // ── list_order_transactions ──────────────────────────────────────────────────
  server.registerTool(
    'list_order_transactions',
    {
      description:
        'List all transactions for a specific order. Returns payment attempts, captures, refunds, and voids linked to the order.',
      inputSchema: {
        order_id: z.number().int().describe('Order ID to list transactions for. Required.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const raw = await client.get(`/orders/${args.order_id}/transactions.json`);
        const parsed = TransactionListResponseSchema.safeParse(raw);
        if (!parsed.success)
          return errResponse('Invalid response from Sapo API: transactions list');
        return okResponse(parsed.data.transactions);
      }, 'Order');
    },
  );

  // ── create_order_transaction ─────────────────────────────────────────────────
  server.registerTool(
    'create_order_transaction',
    {
      description:
        'Create a transaction for an order (e.g. capture, sale, refund). Side effect: creates a Transaction record and may change order financial_status. kind: authorization | capture | sale | void | refund.',
      inputSchema: {
        order_id: z.number().int().describe('Order ID to create transaction for. Required.'),
        kind: z
          .enum(['authorization', 'capture', 'sale', 'void', 'refund'])
          .describe('Transaction kind. Required.'),
        amount: z.number().describe('Transaction amount in VND (float). Required.'),
        currency: z
          .string()
          .optional()
          .describe('Currency code, defaults to "VND" for Sapo stores.'),
        gateway: z
          .string()
          .optional()
          .describe('Payment gateway name (e.g. "cod", "bank_transfer").'),
        parent_id: z
          .number()
          .int()
          .optional()
          .describe('Parent transaction ID (required for capture/void/refund kinds).'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const transaction: Record<string, unknown> = {
          kind: args.kind,
          amount: args.amount,
        };
        if (args.currency) transaction.currency = args.currency;
        if (args.gateway) transaction.gateway = args.gateway;
        if (args.parent_id !== undefined) transaction.parent_id = args.parent_id;

        const raw = await client.post(`/orders/${args.order_id}/transactions.json`, {
          transaction,
        });
        const parsed = TransactionSingleResponseSchema.safeParse(raw);
        if (!parsed.success)
          return errResponse('Invalid response from Sapo API: create transaction');
        return okResponse(parsed.data.transaction);
      }, 'Order');
    },
  );
}
