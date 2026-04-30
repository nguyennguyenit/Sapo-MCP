/**
 * Products SEO tool for web mode (SEO/content team persona).
 * Registers: update_product_seo (S)
 *
 * SEO-only update: ONLY allows meta_title, meta_description, slug (alias), tags.
 * For full product edits (price, stock, variants, images), use a dedicated product tool.
 *
 * Endpoint: PUT /admin/products/{id}.json
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import { ProductSeoSingleResponseSchema } from '../schemas/product-seo.js';
import { errResponse, handleNotFound, okResponse } from './tool-response.js';

export function registerProductSeoTools(server: McpServer, client: SapoClient): void {
  server.registerTool(
    'update_product_seo',
    {
      description:
        'SEO-only update for a product: set meta_title, meta_description, URL slug, and tags. ' +
        'For SEO/content team. Does NOT modify price, stock, variants, or images. ' +
        'For full product edits use a dedicated product management tool.',
      inputSchema: {
        product_id: z.number().int().describe('Product ID to update SEO fields on. Required.'),
        meta_title: z
          .string()
          .optional()
          .nullable()
          .describe('SEO meta title override shown in search engine results.'),
        meta_description: z
          .string()
          .optional()
          .nullable()
          .describe('SEO meta description shown in search snippets (recommended ≤160 chars).'),
        slug: z
          .string()
          .optional()
          .nullable()
          .describe('URL slug/handle for the product page. Mapped to the "alias" field in Sapo.'),
        tags: z
          .string()
          .optional()
          .nullable()
          .describe('Comma-separated tag string for SEO categorization.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        // Build body with only the SEO-allowed fields.
        // "slug" maps to Sapo's "alias" field.
        const product: Record<string, unknown> = {};
        if (args.meta_title !== undefined) product.meta_title = args.meta_title;
        if (args.meta_description !== undefined) product.meta_description = args.meta_description;
        if (args.slug !== undefined) product.alias = args.slug;
        if (args.tags !== undefined) product.tags = args.tags;

        const raw = await client.put(`/products/${args.product_id}.json`, { product });
        const parsed = ProductSeoSingleResponseSchema.safeParse(raw);
        if (!parsed.success) {
          return errResponse('Invalid response from Sapo API: update product SEO');
        }
        return okResponse(parsed.data.product);
      }, 'Product');
    },
  );
}
