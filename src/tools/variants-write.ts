/**
 * Variant write tools for pos-counter mode.
 * Registers: update_variant
 *
 * Note: delete_variant lives in destructive-resources.ts (pos-online mode).
 * Do NOT duplicate it here.
 *
 * Sapo endpoint: PUT /admin/products/{pid}/variants/{id}.json
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import { VariantSingleResponseSchema } from '../schemas/variant.js';
import { errResponse, handleNotFound, okResponse } from './tool-response.js';

export function registerVariantWriteTools(server: McpServer, client: SapoClient): void {
  // ── update_variant ───────────────────────────────────────────────────────────
  server.registerTool(
    'update_variant',
    {
      description:
        'Update a product variant (price, compare_at_price, SKU, barcode, weight). For store owners / inventory managers. Provide only the fields you want to change.',
      inputSchema: {
        product_id: z.number().int().describe('Product ID that owns the variant. Required.'),
        variant_id: z.number().int().describe('Variant ID to update. Required.'),
        price: z
          .number()
          .optional()
          .describe('Selling price in VND (float with up to 4 decimal places).'),
        compare_at_price: z
          .number()
          .nullable()
          .optional()
          .describe('Original/crossed-out price in VND. Set null to clear.'),
        sku: z.string().nullable().optional().describe('Stock-keeping unit code.'),
        barcode: z.string().nullable().optional().describe('Barcode (EAN, UPC, ISBN).'),
        weight: z.number().optional().describe('Weight in grams.'),
        requires_shipping: z.boolean().optional().describe('Whether variant requires shipping.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const variant: Record<string, unknown> = { id: args.variant_id };
        if (args.price !== undefined) variant.price = args.price;
        if (args.compare_at_price !== undefined) variant.compare_at_price = args.compare_at_price;
        if (args.sku !== undefined) variant.sku = args.sku;
        if (args.barcode !== undefined) variant.barcode = args.barcode;
        if (args.weight !== undefined) variant.weight = args.weight;
        if (args.requires_shipping !== undefined)
          variant.requires_shipping = args.requires_shipping;

        const raw = await client.put(
          `/products/${args.product_id}/variants/${args.variant_id}.json`,
          { variant },
        );
        const parsed = VariantSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: variant update');
        return okResponse(parsed.data.variant);
      }, 'Variant');
    },
  );
}
