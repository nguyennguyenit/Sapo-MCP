/**
 * Product read-only tools for pos-online mode.
 * Registers: list_products, get_product, search_products, count_products
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import { ProductListResponseSchema, ProductSingleResponseSchema } from '../schemas/product.js';
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

export function registerProductReadTools(server: McpServer, client: SapoClient): void {
  // ── list_products ───────────────────────────────────────────────────────────
  server.registerTool(
    'list_products',
    {
      description:
        'List products with optional filters (status, vendor, product_type). Returns paginated results via since_id cursor. If has_more=true, call again with next_since_id.',
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
          .describe('Return products with ID greater than this value (cursor pagination).'),
        status: z
          .enum(['active', 'archived', 'draft'])
          .optional()
          .describe('Filter by product status: active, archived, or draft.'),
        vendor: z.string().optional().describe('Filter by vendor name (exact match).'),
        product_type: z.string().optional().describe('Filter by product type (exact match).'),
        created_on_min: z.string().optional().describe('Filter by created date min (ISO 8601).'),
        created_on_max: z.string().optional().describe('Filter by created date max (ISO 8601).'),
      },
    },
    async (args) => {
      const limit = args.limit ?? 50;
      const params: Record<string, string | number | boolean | undefined> = { limit };
      if (args.since_id !== undefined) params.since_id = args.since_id;
      if (args.status) params.status = args.status;
      if (args.vendor) params.vendor = args.vendor;
      if (args.product_type) params.product_type = args.product_type;
      if (args.created_on_min) params.created_on_min = args.created_on_min;
      if (args.created_on_max) params.created_on_max = args.created_on_max;

      const raw = await client.get('/products.json', { params });
      const parsed = ProductListResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: products list');
      const envelope = buildEnvelope(parsed.data.products, limit);
      return okResponse(envelope);
    },
  );

  // ── get_product ─────────────────────────────────────────────────────────────
  server.registerTool(
    'get_product',
    {
      description: 'Get a single product by ID, including its variants, options, and images.',
      inputSchema: {
        product_id: z.number().int().describe('Product ID (numeric). Required.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const raw = await client.get(`/products/${args.product_id}.json`);
        const parsed = ProductSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: product');
        return okResponse(parsed.data.product);
      }, 'Product');
    },
  );

  // ── search_products ─────────────────────────────────────────────────────────
  server.registerTool(
    'search_products',
    {
      description:
        'Search products by title substring. Uses the title filter on the list endpoint. Returns paginated results.',
      inputSchema: {
        title: z.string().describe('Product title substring to search for.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(250)
          .optional()
          .describe('Max results per page (default 50, max 250).'),
        status: z
          .enum(['active', 'archived', 'draft'])
          .optional()
          .describe('Optionally filter results by product status.'),
      },
    },
    async (args) => {
      const limit = args.limit ?? 50;
      const params: Record<string, string | number | boolean | undefined> = {
        limit,
        title: args.title,
      };
      if (args.status) params.status = args.status;

      const raw = await client.get('/products.json', { params });
      const parsed = ProductListResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: product search');
      const envelope = buildEnvelope(parsed.data.products, limit);
      return okResponse(envelope);
    },
  );

  // ── count_products ──────────────────────────────────────────────────────────
  server.registerTool(
    'count_products',
    {
      description:
        'Count total products in the store, optionally filtered by status, vendor, or product_type.',
      inputSchema: {
        status: z
          .enum(['active', 'archived', 'draft'])
          .optional()
          .describe('Filter count by product status.'),
        vendor: z.string().optional().describe('Filter count by vendor name.'),
        product_type: z.string().optional().describe('Filter count by product type.'),
      },
    },
    async (args) => {
      const params: Record<string, string | number | boolean | undefined> = {};
      if (args.status) params.status = args.status;
      if (args.vendor) params.vendor = args.vendor;
      if (args.product_type) params.product_type = args.product_type;

      const raw = await client.get('/products/count.json', { params });
      return okResponse(raw);
    },
  );
}
