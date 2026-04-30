/**
 * Variant read-only tools for pos-online mode.
 * Registers: list_variants_for_product, get_variant
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import { VariantListResponseSchema, VariantSingleResponseSchema } from '../schemas/variant.js';
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

export function registerVariantReadTools(server: McpServer, client: SapoClient): void {
  // Idempotent: variant read tools are shared across modes (pos-online + web).
  // When `--mode=pos-online,web`, both registrars run; skip if already present.
  const registered = (server as unknown as { _registeredTools?: Record<string, unknown> })
    ._registeredTools;
  if (registered?.list_variants_for_product) {
    return;
  }

  // ── list_variants_for_product ───────────────────────────────────────────────
  server.registerTool(
    'list_variants_for_product',
    {
      description:
        'List all variants for a product (SKUs, prices in VND, inventory quantities). Returns paginated results via since_id cursor.',
      inputSchema: {
        product_id: z.number().int().describe('Product ID whose variants to list. Required.'),
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
          .describe('Return variants with ID greater than this value (cursor pagination).'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const limit = args.limit ?? 50;
        const params: Record<string, string | number | boolean | undefined> = { limit };
        if (args.since_id !== undefined) params.since_id = args.since_id;

        const raw = await client.get(`/products/${args.product_id}/variants.json`, { params });
        const parsed = VariantListResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: variants');
        const envelope = buildEnvelope(parsed.data.variants, limit);
        return okResponse(envelope);
      }, 'Product');
    },
  );

  // ── get_variant ─────────────────────────────────────────────────────────────
  server.registerTool(
    'get_variant',
    {
      description:
        'Get a single product variant by ID. Returns price (VND, float with 4 decimals), SKU, barcode, inventory quantity, and option values.',
      inputSchema: {
        variant_id: z.number().int().describe('Variant ID (numeric). Required.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const raw = await client.get(`/variants/${args.variant_id}.json`);
        const parsed = VariantSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: variant');
        return okResponse(parsed.data.variant);
      }, 'Variant');
    },
  );
}
