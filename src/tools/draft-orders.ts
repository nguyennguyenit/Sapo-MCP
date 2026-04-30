/**
 * Draft order tools for pos-online mode.
 * Registers: list_draft_orders, get_draft_order, create_draft_order,
 *            update_draft_order, complete_draft_order, send_draft_order_invoice
 *
 * Sapo endpoints:
 *   GET  /admin/draft_orders.json
 *   GET  /admin/draft_orders/{id}.json
 *   POST /admin/draft_orders.json
 *   PUT  /admin/draft_orders/{id}.json
 *   PUT  /admin/draft_orders/{id}/complete.json
 *   POST /admin/draft_orders/{id}/send_invoice.json
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import {
  DraftOrderListResponseSchema,
  DraftOrderSingleResponseSchema,
} from '../schemas/draft-order.js';
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

export function registerDraftOrderTools(server: McpServer, client: SapoClient): void {
  // ── list_draft_orders ────────────────────────────────────────────────────────
  server.registerTool(
    'list_draft_orders',
    {
      description:
        'List draft orders with optional filters. Returns paginated results via since_id cursor. Filter by status. If has_more=true, call again with next_since_id.',
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
          .describe('Return draft orders with ID greater than this value (cursor pagination).'),
        status: z
          .enum(['open', 'completed', 'invoice_sent', 'cancelled'])
          .optional()
          .describe('Filter by draft order status.'),
      },
    },
    async (args) => {
      const limit = args.limit ?? 50;
      const params: Record<string, string | number | boolean | undefined> = { limit };
      if (args.since_id !== undefined) params.since_id = args.since_id;
      if (args.status) params.status = args.status;

      const raw = await client.get('/draft_orders.json', { params });
      const parsed = DraftOrderListResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: draft orders list');
      const envelope = buildEnvelope(parsed.data.draft_orders, limit);
      return okResponse(envelope);
    },
  );

  // ── get_draft_order ──────────────────────────────────────────────────────────
  server.registerTool(
    'get_draft_order',
    {
      description:
        'Get a single draft order by ID. Returns full draft order including line_items, customer, address, and applied discounts.',
      inputSchema: {
        draft_order_id: z.number().int().describe('Draft order ID (numeric). Required.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const raw = await client.get(`/draft_orders/${args.draft_order_id}.json`);
        const parsed = DraftOrderSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: draft order');
        return okResponse(parsed.data.draft_order);
      }, 'DraftOrder');
    },
  );

  // ── create_draft_order ───────────────────────────────────────────────────────
  server.registerTool(
    'create_draft_order',
    {
      description:
        'Create a new draft order. Side effect: creates a DraftOrder in "open" status. Requires at least one line_item with variant_id or title+price for custom items.',
      inputSchema: {
        line_items: z
          .array(
            z.object({
              variant_id: z.number().int().optional().describe('Variant ID for existing products.'),
              title: z.string().optional().describe('Line item title (for custom items).'),
              price: z.number().optional().describe('Unit price in VND (for custom items).'),
              quantity: z.number().int().describe('Quantity (required).'),
              sku: z.string().optional().describe('SKU (optional).'),
            }),
          )
          .describe('Line items to include. At least one required.'),
        customer_id: z.number().int().optional().describe('Associate with an existing customer.'),
        email: z.string().optional().describe('Customer email for the draft order.'),
        note: z.string().optional().describe('Order note visible to staff.'),
        tags: z.string().optional().describe('Comma-separated tags.'),
        shipping_address: z
          .record(z.unknown())
          .optional()
          .describe('Shipping address object (first_name, last_name, address1, city, ...).'),
        billing_address: z.record(z.unknown()).optional().describe('Billing address object.'),
        applied_discount: z
          .record(z.unknown())
          .optional()
          .describe('Discount applied to the whole order (value, value_type, title).'),
      },
    },
    async (args) => {
      const draft_order: Record<string, unknown> = { line_items: args.line_items };
      if (args.customer_id !== undefined) draft_order.customer = { id: args.customer_id };
      if (args.email !== undefined) draft_order.email = args.email;
      if (args.note !== undefined) draft_order.note = args.note;
      if (args.tags !== undefined) draft_order.tags = args.tags;
      if (args.shipping_address !== undefined) draft_order.shipping_address = args.shipping_address;
      if (args.billing_address !== undefined) draft_order.billing_address = args.billing_address;
      if (args.applied_discount !== undefined) draft_order.applied_discount = args.applied_discount;

      const raw = await client.post('/draft_orders.json', { draft_order });
      const parsed = DraftOrderSingleResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: create draft order');
      return okResponse(parsed.data.draft_order);
    },
  );

  // ── update_draft_order ───────────────────────────────────────────────────────
  server.registerTool(
    'update_draft_order',
    {
      description:
        'Update a draft order in "open" status. Side effect: modifies draft order fields. Cannot update completed or cancelled drafts.',
      inputSchema: {
        draft_order_id: z.number().int().describe('Draft order ID to update. Required.'),
        line_items: z
          .array(z.record(z.unknown()))
          .optional()
          .describe('Replace line_items (replaces all existing items).'),
        customer_id: z
          .number()
          .int()
          .optional()
          .describe(
            'Associate the draft with an existing customer. Sapo does not support clearing the customer via this field — omit to leave unchanged.',
          ),
        note: z.string().optional().describe('Updated order note.'),
        tags: z.string().optional().describe('Updated comma-separated tags.'),
        email: z.string().optional().describe('Updated customer email.'),
        shipping_address: z.record(z.unknown()).optional().describe('Updated shipping address.'),
        billing_address: z.record(z.unknown()).optional().describe('Updated billing address.'),
        applied_discount: z
          .record(z.unknown())
          .optional()
          .describe('Updated order-level discount.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const { draft_order_id, customer_id, ...rest } = args;
        const draft_order: Record<string, unknown> = {};
        if (rest.line_items !== undefined) draft_order.line_items = rest.line_items;
        if (customer_id !== undefined) draft_order.customer = { id: customer_id };
        if (rest.note !== undefined) draft_order.note = rest.note;
        if (rest.tags !== undefined) draft_order.tags = rest.tags;
        if (rest.email !== undefined) draft_order.email = rest.email;
        if (rest.shipping_address !== undefined)
          draft_order.shipping_address = rest.shipping_address;
        if (rest.billing_address !== undefined) draft_order.billing_address = rest.billing_address;
        if (rest.applied_discount !== undefined)
          draft_order.applied_discount = rest.applied_discount;

        const raw = await client.put(`/draft_orders/${draft_order_id}.json`, { draft_order });
        const parsed = DraftOrderSingleResponseSchema.safeParse(raw);
        if (!parsed.success)
          return errResponse('Invalid response from Sapo API: update draft order');
        return okResponse(parsed.data.draft_order);
      }, 'DraftOrder');
    },
  );

  // ── complete_draft_order ─────────────────────────────────────────────────────
  server.registerTool(
    'complete_draft_order',
    {
      description:
        'Complete a draft order and convert it into a real order. Side effect: creates an Order from the draft; draft status becomes "completed". Use payment_pending=true if payment not yet collected.',
      inputSchema: {
        draft_order_id: z.number().int().describe('Draft order ID to complete. Required.'),
        payment_pending: z
          .boolean()
          .optional()
          .describe('If true, order is created with payment pending. Default false.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const params: Record<string, string | boolean | undefined> = {};
        if (args.payment_pending !== undefined) params.payment_pending = args.payment_pending;

        const raw = await client.put(
          `/draft_orders/${args.draft_order_id}/complete.json`,
          {},
          { params },
        );
        const parsed = DraftOrderSingleResponseSchema.safeParse(raw);
        if (!parsed.success)
          return errResponse('Invalid response from Sapo API: complete draft order');
        return okResponse(parsed.data.draft_order);
      }, 'DraftOrder');
    },
  );

  // ── send_draft_order_invoice ─────────────────────────────────────────────────
  server.registerTool(
    'send_draft_order_invoice',
    {
      description:
        'Send an invoice email for a draft order. Side effect: sends email to customer; draft status becomes "invoice_sent". Requires customer email on the draft or provide via to param.',
      inputSchema: {
        draft_order_id: z.number().int().describe('Draft order ID to invoice. Required.'),
        to: z.string().optional().describe('Override recipient email address.'),
        from: z.string().optional().describe('Override sender email address.'),
        subject: z.string().optional().describe('Override email subject.'),
        custom_message: z
          .string()
          .optional()
          .describe('Custom message body included in the email.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const draft_order_invoice: Record<string, unknown> = {};
        if (args.to !== undefined) draft_order_invoice.to = args.to;
        if (args.from !== undefined) draft_order_invoice.from = args.from;
        if (args.subject !== undefined) draft_order_invoice.subject = args.subject;
        if (args.custom_message !== undefined)
          draft_order_invoice.custom_message = args.custom_message;

        const raw = await client.post(`/draft_orders/${args.draft_order_id}/send_invoice.json`, {
          draft_order_invoice,
        });
        return okResponse(raw);
      }, 'DraftOrder');
    },
  );
}
