/**
 * Collection tools for web mode (SEO/content team persona).
 * Registers: list_custom_collections, get_custom_collection, create_custom_collection,
 *            update_custom_collection, delete_custom_collection,
 *            list_smart_collections, get_smart_collection,
 *            list_collects, create_collect, delete_collect
 *
 * Endpoints:
 *   GET    /admin/custom_collections.json
 *   GET    /admin/custom_collections/{id}.json
 *   POST   /admin/custom_collections.json
 *   PUT    /admin/custom_collections/{id}.json
 *   DELETE /admin/custom_collections/{id}.json
 *   GET    /admin/smart_collections.json
 *   GET    /admin/smart_collections/{id}.json
 *   GET    /admin/collects.json
 *   POST   /admin/collects.json
 *   DELETE /admin/collects/{id}.json
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import type { GuardContext } from '../guards.js';
import { registerIfAllowed } from '../guards.js';
import { CollectListResponseSchema, CollectSingleResponseSchema } from '../schemas/collect.js';
import {
  CustomCollectionListResponseSchema,
  CustomCollectionSingleResponseSchema,
  SmartCollectionListResponseSchema,
  SmartCollectionSingleResponseSchema,
} from '../schemas/collection.js';
import { errResponse, handleNotFound, okResponse } from './tool-response.js';

interface ListEnvelope<T> {
  data: T[];
  has_more: boolean;
  next_since_id: number | null;
}

function buildEnvelope<T extends { id: number }>(items: T[], limit: number): ListEnvelope<T> {
  const has_more = items.length === limit;
  const last = items[items.length - 1];
  return { data: items, has_more, next_since_id: has_more && last ? last.id : null };
}

// ── Custom Collections (R) ─────────────────────────────────────────────────────

function registerCustomCollectionReadTools(server: McpServer, client: SapoClient): void {
  server.registerTool(
    'list_custom_collections',
    {
      description:
        'List custom (manual) collections. For SEO/content team: use to browse collections ' +
        'to update descriptions, images, or SEO metadata. Paginated via since_id cursor.',
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
          .describe('Return collections with ID greater than this value (cursor pagination).'),
        title: z.string().optional().describe('Filter by exact title match.'),
        published_status: z
          .enum(['published', 'unpublished', 'any'])
          .optional()
          .describe('Filter by published status (default: any).'),
      },
    },
    async (args) => {
      const limit = args.limit ?? 50;
      const params: Record<string, string | number | undefined> = { limit };
      if (args.since_id !== undefined) params.since_id = args.since_id;
      if (args.title) params.title = args.title;
      if (args.published_status) params.published_status = args.published_status;

      const raw = await client.get('/custom_collections.json', { params });
      const parsed = CustomCollectionListResponseSchema.safeParse(raw);
      if (!parsed.success)
        return errResponse('Invalid response from Sapo API: custom collections list');
      return okResponse(buildEnvelope(parsed.data.custom_collections, limit));
    },
  );

  server.registerTool(
    'get_custom_collection',
    {
      description:
        'Get a single custom collection by ID, including its body_html, sort_order, image, and SEO fields.',
      inputSchema: {
        collection_id: z.number().int().describe('Custom collection ID. Required.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const raw = await client.get(`/custom_collections/${args.collection_id}.json`);
        const parsed = CustomCollectionSingleResponseSchema.safeParse(raw);
        if (!parsed.success)
          return errResponse('Invalid response from Sapo API: custom collection');
        return okResponse(parsed.data.custom_collection);
      }, 'CustomCollection');
    },
  );
}

// ── Custom Collections (S — create, update) ────────────────────────────────────

function registerCustomCollectionWriteTools(server: McpServer, client: SapoClient): void {
  server.registerTool(
    'create_custom_collection',
    {
      description:
        'Create a new custom (manual) collection. For SEO/content team: set title, body_html, ' +
        'seo_title, seo_description, and sort_order. Products are added via create_collect.',
      inputSchema: {
        title: z.string().describe('Collection title. Required.'),
        body_html: z.string().optional().describe('HTML description of the collection.'),
        sort_order: z
          .enum([
            'alpha-asc',
            'alpha-desc',
            'best-selling',
            'created',
            'created-desc',
            'manual',
            'price-asc',
            'price-desc',
          ])
          .optional()
          .describe('Sort order for products in collection (default: manual).'),
        published: z
          .boolean()
          .optional()
          .describe('Whether collection is published to storefront.'),
        seo_title: z.string().optional().describe('SEO meta title override.'),
        seo_description: z.string().optional().describe('SEO meta description override.'),
        image_src: z.string().optional().describe('URL of collection image.'),
      },
    },
    async (args) => {
      const body: Record<string, unknown> = { title: args.title };
      if (args.body_html !== undefined) body.body_html = args.body_html;
      if (args.sort_order !== undefined) body.sort_order = args.sort_order;
      if (args.published !== undefined) body.published = args.published;
      if (args.seo_title !== undefined) body.seo_title = args.seo_title;
      if (args.seo_description !== undefined) body.seo_description = args.seo_description;
      if (args.image_src !== undefined) body.image = { src: args.image_src };

      const raw = await client.post('/custom_collections.json', {
        custom_collection: body,
      });
      const parsed = CustomCollectionSingleResponseSchema.safeParse(raw);
      if (!parsed.success)
        return errResponse('Invalid response from Sapo API: create custom collection');
      return okResponse(parsed.data.custom_collection);
    },
  );

  server.registerTool(
    'update_custom_collection',
    {
      description:
        'Update a custom collection. For SEO/content team: update title, body_html, ' +
        'seo_title, seo_description, or published status.',
      inputSchema: {
        collection_id: z.number().int().describe('Custom collection ID to update. Required.'),
        title: z.string().optional().describe('New collection title.'),
        body_html: z.string().optional().describe('New HTML description.'),
        sort_order: z
          .enum([
            'alpha-asc',
            'alpha-desc',
            'best-selling',
            'created',
            'created-desc',
            'manual',
            'price-asc',
            'price-desc',
          ])
          .optional()
          .describe('New sort order for products in collection.'),
        published: z.boolean().optional().describe('Publish or unpublish the collection.'),
        seo_title: z.string().optional().describe('SEO meta title override.'),
        seo_description: z.string().optional().describe('SEO meta description override.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const body: Record<string, unknown> = {};
        if (args.title !== undefined) body.title = args.title;
        if (args.body_html !== undefined) body.body_html = args.body_html;
        if (args.sort_order !== undefined) body.sort_order = args.sort_order;
        if (args.published !== undefined) body.published = args.published;
        if (args.seo_title !== undefined) body.seo_title = args.seo_title;
        if (args.seo_description !== undefined) body.seo_description = args.seo_description;

        const raw = await client.put(`/custom_collections/${args.collection_id}.json`, {
          custom_collection: body,
        });
        const parsed = CustomCollectionSingleResponseSchema.safeParse(raw);
        if (!parsed.success)
          return errResponse('Invalid response from Sapo API: update custom collection');
        return okResponse(parsed.data.custom_collection);
      }, 'CustomCollection');
    },
  );
}

// ── Custom Collections (D — delete) ───────────────────────────────────────────

function registerCustomCollectionDestructiveTools(
  server: McpServer,
  client: SapoClient,
  ctx: GuardContext,
): void {
  registerIfAllowed(
    server,
    {
      name: 'delete_custom_collection',
      category: 'delete',
      description:
        '[DESTRUCTIVE: delete] Permanently delete a custom collection. Cannot be undone. ' +
        'Products are NOT deleted — only the collection grouping is removed. ' +
        'Requires SAPO_ALLOW_OPS=delete AND confirm:true.',
      inputSchema: {
        confirm: z
          .literal(true)
          .describe('Must be true. Explicit confirmation required for destructive operations.'),
        collection_id: z.number().int().describe('Custom collection ID to delete. Required.'),
      },
      handler: async (args) => {
        return handleNotFound(async () => {
          await client.delete(`/custom_collections/${args.collection_id}.json`);
          return okResponse({ deleted: true, id: args.collection_id });
        }, 'CustomCollection');
      },
    },
    ctx,
  );
}

// ── Smart Collections (R only) ─────────────────────────────────────────────────

function registerSmartCollectionReadTools(server: McpServer, client: SapoClient): void {
  server.registerTool(
    'list_smart_collections',
    {
      description:
        'List smart (rule-based) collections. For SEO/content team: view auto-generated collections ' +
        'and their matching rules. Paginated via since_id cursor.',
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
          .describe('Return collections with ID greater than this value (cursor pagination).'),
        title: z.string().optional().describe('Filter by exact title match.'),
        published_status: z
          .enum(['published', 'unpublished', 'any'])
          .optional()
          .describe('Filter by published status (default: any).'),
      },
    },
    async (args) => {
      const limit = args.limit ?? 50;
      const params: Record<string, string | number | undefined> = { limit };
      if (args.since_id !== undefined) params.since_id = args.since_id;
      if (args.title) params.title = args.title;
      if (args.published_status) params.published_status = args.published_status;

      const raw = await client.get('/smart_collections.json', { params });
      const parsed = SmartCollectionListResponseSchema.safeParse(raw);
      if (!parsed.success)
        return errResponse('Invalid response from Sapo API: smart collections list');
      return okResponse(buildEnvelope(parsed.data.smart_collections, limit));
    },
  );

  server.registerTool(
    'get_smart_collection',
    {
      description:
        'Get a single smart collection by ID, including its matching rules and SEO fields.',
      inputSchema: {
        collection_id: z.number().int().describe('Smart collection ID. Required.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const raw = await client.get(`/smart_collections/${args.collection_id}.json`);
        const parsed = SmartCollectionSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: smart collection');
        return okResponse(parsed.data.smart_collection);
      }, 'SmartCollection');
    },
  );
}

// ── Collects (product ↔ collection mapping) ────────────────────────────────────

function registerCollectReadTools(server: McpServer, client: SapoClient): void {
  server.registerTool(
    'list_collects',
    {
      description:
        'List product-to-collection mappings (collects). ' +
        'Filter by collection_id to see all products in a collection, ' +
        'or by product_id to see all collections a product belongs to.',
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
          .describe('Return collects with ID greater than this value (cursor pagination).'),
        collection_id: z
          .number()
          .int()
          .optional()
          .describe('Filter by collection ID — lists all products in this collection.'),
        product_id: z
          .number()
          .int()
          .optional()
          .describe('Filter by product ID — lists all collections this product is in.'),
      },
    },
    async (args) => {
      const limit = args.limit ?? 50;
      const params: Record<string, string | number | undefined> = { limit };
      if (args.since_id !== undefined) params.since_id = args.since_id;
      if (args.collection_id !== undefined) params.collection_id = args.collection_id;
      if (args.product_id !== undefined) params.product_id = args.product_id;

      const raw = await client.get('/collects.json', { params });
      const parsed = CollectListResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: collects list');
      return okResponse(buildEnvelope(parsed.data.collects, limit));
    },
  );
}

function registerCollectWriteTools(server: McpServer, client: SapoClient): void {
  server.registerTool(
    'create_collect',
    {
      description:
        'Add a product to a custom collection by creating a collect mapping. ' +
        'Use position to control order in manual sort collections.',
      inputSchema: {
        collection_id: z.number().int().describe('Custom collection ID. Required.'),
        product_id: z.number().int().describe('Product ID to add to the collection. Required.'),
        position: z
          .number()
          .int()
          .optional()
          .describe('Sort position in collection (only applies to manual sort_order).'),
      },
    },
    async (args) => {
      const body: Record<string, unknown> = {
        collection_id: args.collection_id,
        product_id: args.product_id,
      };
      if (args.position !== undefined) body.position = args.position;

      const raw = await client.post('/collects.json', { collect: body });
      const parsed = CollectSingleResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: create collect');
      return okResponse(parsed.data.collect);
    },
  );
}

function registerCollectDestructiveTools(
  server: McpServer,
  client: SapoClient,
  ctx: GuardContext,
): void {
  registerIfAllowed(
    server,
    {
      name: 'delete_collect',
      category: 'delete',
      description:
        '[DESTRUCTIVE: delete] Remove a product from a custom collection by deleting its collect mapping. ' +
        'The product itself is NOT deleted — only the collection association is removed. ' +
        'Requires SAPO_ALLOW_OPS=delete AND confirm:true.',
      inputSchema: {
        confirm: z
          .literal(true)
          .describe('Must be true. Explicit confirmation required for destructive operations.'),
        collect_id: z.number().int().describe('Collect mapping ID to delete. Required.'),
      },
      handler: async (args) => {
        return handleNotFound(async () => {
          await client.delete(`/collects/${args.collect_id}.json`);
          return okResponse({ deleted: true, id: args.collect_id });
        }, 'Collect');
      },
    },
    ctx,
  );
}

// ── Main register function ─────────────────────────────────────────────────────

export function registerCollectionTools(
  server: McpServer,
  client: SapoClient,
  ctx: GuardContext,
): void {
  registerCustomCollectionReadTools(server, client);
  registerCustomCollectionWriteTools(server, client);
  registerCustomCollectionDestructiveTools(server, client, ctx);
  registerSmartCollectionReadTools(server, client);
  registerCollectReadTools(server, client);
  registerCollectWriteTools(server, client);
  registerCollectDestructiveTools(server, client, ctx);
}
