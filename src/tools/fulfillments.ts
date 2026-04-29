/**
 * Fulfillment tools for pos-online mode.
 * Registers: list_fulfillments_for_order, get_fulfillment,
 *            create_fulfillment, update_fulfillment_tracking
 *
 * Sapo endpoints:
 *   GET  /admin/orders/{order_id}/fulfillments.json
 *   GET  /admin/fulfillments/{id}.json
 *   POST /admin/orders/{order_id}/fulfillments.json
 *   PUT  /admin/fulfillments/{id}.json
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import {
  FulfillmentListResponseSchema,
  FulfillmentSingleResponseSchema,
} from '../schemas/fulfillment.js';
import { errResponse, handleNotFound, okResponse } from './tool-response.js';

export function registerFulfillmentTools(server: McpServer, client: SapoClient): void {
  // ── list_fulfillments_for_order ──────────────────────────────────────────────
  server.registerTool(
    'list_fulfillments_for_order',
    {
      description:
        'List all fulfillments for a specific order. Returns fulfillment records with tracking info, line_items, and delivery status.',
      inputSchema: {
        order_id: z.number().int().describe('Order ID to list fulfillments for. Required.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const raw = await client.get(`/orders/${args.order_id}/fulfillments.json`);
        const parsed = FulfillmentListResponseSchema.safeParse(raw);
        if (!parsed.success)
          return errResponse('Invalid response from Sapo API: fulfillments list');
        return okResponse(parsed.data.fulfillments);
      }, 'Order');
    },
  );

  // ── get_fulfillment ─────────────────────────────────────────────────────────
  server.registerTool(
    'get_fulfillment',
    {
      description:
        'Get a single fulfillment by ID. Returns full fulfillment with tracking info, line_items, and origin address.',
      inputSchema: {
        fulfillment_id: z.number().int().describe('Fulfillment ID (numeric). Required.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const raw = await client.get(`/fulfillments/${args.fulfillment_id}.json`);
        const parsed = FulfillmentSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: fulfillment');
        return okResponse(parsed.data.fulfillment);
      }, 'Fulfillment');
    },
  );

  // ── create_fulfillment ──────────────────────────────────────────────────────
  server.registerTool(
    'create_fulfillment',
    {
      description:
        'Create a fulfillment for an order, optionally specifying line items and tracking info. Side effect: creates a Fulfillment record and marks specified line_items as fulfilled.',
      inputSchema: {
        order_id: z.number().int().describe('Order ID to fulfill. Required.'),
        line_items: z
          .array(
            z.object({
              id: z.number().int().describe('Line item ID.'),
              quantity: z.number().int().optional().describe('Quantity to fulfill.'),
            }),
          )
          .optional()
          .describe('Specific line items to fulfill. If omitted, fulfills all unfulfilled items.'),
        tracking_company: z
          .string()
          .optional()
          .describe('Shipping carrier name e.g. "Giao Hàng Nhanh", "GHTK".'),
        tracking_number: z.string().optional().describe('Tracking number from carrier.'),
        tracking_url: z.string().optional().describe('Full tracking URL.'),
        notify_customer: z
          .boolean()
          .optional()
          .describe('Whether to send fulfillment notification to customer.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const fulfillment: Record<string, unknown> = {};
        if (args.line_items) fulfillment.line_items = args.line_items;
        if (args.tracking_company) fulfillment.tracking_company = args.tracking_company;
        if (args.tracking_number) fulfillment.tracking_number = args.tracking_number;
        if (args.tracking_url) fulfillment.tracking_url = args.tracking_url;
        if (args.notify_customer !== undefined) fulfillment.notify_customer = args.notify_customer;

        const raw = await client.post(`/orders/${args.order_id}/fulfillments.json`, {
          fulfillment,
        });
        const parsed = FulfillmentSingleResponseSchema.safeParse(raw);
        if (!parsed.success)
          return errResponse('Invalid response from Sapo API: create fulfillment');
        return okResponse(parsed.data.fulfillment);
      }, 'Order');
    },
  );

  // ── update_fulfillment_tracking ─────────────────────────────────────────────
  server.registerTool(
    'update_fulfillment_tracking',
    {
      description:
        'Update tracking information for an existing fulfillment. Side effect: modifies the Fulfillment tracking_company, tracking_number, or tracking_url.',
      inputSchema: {
        fulfillment_id: z.number().int().describe('Fulfillment ID to update. Required.'),
        tracking_company: z.string().optional().describe('Updated carrier/shipping company name.'),
        tracking_number: z.string().optional().describe('Updated tracking number.'),
        tracking_url: z.string().optional().describe('Updated full tracking URL.'),
        notify_customer: z
          .boolean()
          .optional()
          .describe('Whether to send tracking update notification to customer.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const fulfillment: Record<string, unknown> = {};
        if (args.tracking_company !== undefined)
          fulfillment.tracking_company = args.tracking_company;
        if (args.tracking_number !== undefined) fulfillment.tracking_number = args.tracking_number;
        if (args.tracking_url !== undefined) fulfillment.tracking_url = args.tracking_url;
        if (args.notify_customer !== undefined) fulfillment.notify_customer = args.notify_customer;

        const raw = await client.put(`/fulfillments/${args.fulfillment_id}.json`, {
          fulfillment,
        });
        const parsed = FulfillmentSingleResponseSchema.safeParse(raw);
        if (!parsed.success)
          return errResponse('Invalid response from Sapo API: update fulfillment tracking');
        return okResponse(parsed.data.fulfillment);
      }, 'Fulfillment');
    },
  );
}
