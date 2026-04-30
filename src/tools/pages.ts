/**
 * Page tools for web mode (SEO/content team persona).
 * Registers: list_pages, get_page (R)
 *            update_page_seo (S — SEO-only fields, strict subset)
 *            delete_page (D — gated via SAPO_ALLOW_OPS=delete + confirm:true)
 *
 * SEO-only update fields: meta_title, meta_description, handle (slug), tags, published.
 * Body/title/author updates are intentionally deferred to update_page (Batch C+).
 *
 * Endpoints:
 *   GET    /admin/pages.json
 *   GET    /admin/pages/{id}.json
 *   PUT    /admin/pages/{id}.json
 *   DELETE /admin/pages/{id}.json
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import type { GuardContext } from '../guards.js';
import { registerIfAllowed } from '../guards.js';
import { PageListResponseSchema, PageSingleResponseSchema } from '../schemas/page.js';
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

// ── Read tools ─────────────────────────────────────────────────────────────────

function registerPageReadTools(server: McpServer, client: SapoClient): void {
  server.registerTool(
    'list_pages',
    {
      description:
        'List all storefront pages. For SEO/content team: browse pages to audit SEO metadata, ' +
        'published status, and URL handles. Paginated via since_id cursor.',
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
          .describe('Return pages with ID greater than this value (cursor pagination).'),
        title: z.string().optional().describe('Filter by exact title match.'),
        handle: z.string().optional().describe('Filter by URL handle/slug.'),
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
      if (args.handle) params.handle = args.handle;
      if (args.published_status) params.published_status = args.published_status;

      const raw = await client.get('/pages.json', { params });
      const parsed = PageListResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: pages list');
      return okResponse(buildEnvelope(parsed.data.pages, limit));
    },
  );

  server.registerTool(
    'get_page',
    {
      description:
        'Get a single storefront page by ID, including its body_html, SEO meta fields, ' +
        'handle (URL slug), tags, and published status.',
      inputSchema: {
        page_id: z.number().int().describe('Page ID. Required.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const raw = await client.get(`/pages/${args.page_id}.json`);
        const parsed = PageSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: page');
        return okResponse(parsed.data.page);
      }, 'Page');
    },
  );
}

// ── SEO update tool ────────────────────────────────────────────────────────────

function registerPageSeoWriteTools(server: McpServer, client: SapoClient): void {
  server.registerTool(
    'update_page_seo',
    {
      description:
        'SEO-only update for a storefront page. For SEO/content team: update meta_title, ' +
        'meta_description, handle (URL slug), tags, and published visibility. ' +
        'This tool intentionally does NOT expose body_html, title, or author — ' +
        'use update_page (deferred) for full content edits.',
      inputSchema: {
        page_id: z.number().int().describe('Page ID to update. Required.'),
        meta_title: z
          .string()
          .nullable()
          .optional()
          .describe(
            'SEO meta title override (shown in <title> tag and search results). Pass null to clear.',
          ),
        meta_description: z
          .string()
          .nullable()
          .optional()
          .describe(
            'SEO meta description override (shown in search result snippets). Pass null to clear.',
          ),
        handle: z
          .string()
          .nullable()
          .optional()
          .describe(
            'URL handle/slug for the page (e.g. "about-us" → /pages/about-us). Pass null to clear.',
          ),
        tags: z
          .string()
          .nullable()
          .optional()
          .describe('Comma-separated tags for the page. Pass null to clear.'),
        published: z.boolean().optional().describe('Publish (true) or unpublish (false) the page.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const body: Record<string, unknown> = {};
        if (args.meta_title !== undefined) body.meta_title = args.meta_title;
        if (args.meta_description !== undefined) body.meta_description = args.meta_description;
        if (args.handle !== undefined) body.handle = args.handle;
        if (args.tags !== undefined) body.tags = args.tags;
        if (args.published !== undefined) body.published = args.published;

        const raw = await client.put(`/pages/${args.page_id}.json`, { page: body });
        const parsed = PageSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: update page SEO');
        return okResponse(parsed.data.page);
      }, 'Page');
    },
  );
}

// ── Destructive tools (delete) ─────────────────────────────────────────────────

function registerPageDestructiveTools(
  server: McpServer,
  client: SapoClient,
  ctx: GuardContext,
): void {
  registerIfAllowed(
    server,
    {
      name: 'delete_page',
      category: 'delete',
      description:
        '[DESTRUCTIVE: delete] Permanently delete a storefront page. Cannot be undone. ' +
        'Requires SAPO_ALLOW_OPS=delete AND confirm:true.',
      inputSchema: {
        confirm: z
          .literal(true)
          .describe('Must be true. Explicit confirmation required for destructive operations.'),
        page_id: z.number().int().describe('Page ID to delete. Required.'),
      },
      handler: async (args) => {
        return handleNotFound(async () => {
          await client.delete(`/pages/${args.page_id}.json`);
          return okResponse({ deleted: true, id: args.page_id });
        }, 'Page');
      },
    },
    ctx,
  );
}

// ── Main register function ─────────────────────────────────────────────────────

export function registerPageTools(server: McpServer, client: SapoClient, ctx: GuardContext): void {
  registerPageReadTools(server, client);
  registerPageSeoWriteTools(server, client);
  registerPageDestructiveTools(server, client, ctx);
}
