/**
 * Blog tools for web mode (SEO/content team persona).
 * Registers: list_blogs, get_blog (R)
 *            create_blog, update_blog (S)
 *            delete_blog (D — gated via SAPO_ALLOW_OPS=delete + confirm:true)
 *
 * Endpoints:
 *   GET    /admin/blogs.json
 *   GET    /admin/blogs/{id}.json
 *   POST   /admin/blogs.json
 *   PUT    /admin/blogs/{id}.json
 *   DELETE /admin/blogs/{id}.json
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import type { GuardContext } from '../guards.js';
import { registerIfAllowed } from '../guards.js';
import { BlogListResponseSchema, BlogSingleResponseSchema } from '../schemas/blog.js';
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

function registerBlogReadTools(server: McpServer, client: SapoClient): void {
  server.registerTool(
    'list_blogs',
    {
      description:
        'List all blogs in the store. For SEO/content team: browse blogs to manage article ' +
        'publication structure. Paginated via since_id cursor.',
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
          .describe('Return blogs with ID greater than this value (cursor pagination).'),
        handle: z.string().optional().describe('Filter by URL handle/slug.'),
      },
    },
    async (args) => {
      const limit = args.limit ?? 50;
      const params: Record<string, string | number | undefined> = { limit };
      if (args.since_id !== undefined) params.since_id = args.since_id;
      if (args.handle) params.handle = args.handle;

      const raw = await client.get('/blogs.json', { params });
      const parsed = BlogListResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: blogs list');
      return okResponse(buildEnvelope(parsed.data.blogs, limit));
    },
  );

  server.registerTool(
    'get_blog',
    {
      description:
        'Get a single blog by ID, including its handle, commentable setting, and tag metadata.',
      inputSchema: {
        blog_id: z.number().int().describe('Blog ID. Required.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const raw = await client.get(`/blogs/${args.blog_id}.json`);
        const parsed = BlogSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: blog');
        return okResponse(parsed.data.blog);
      }, 'Blog');
    },
  );
}

// ── Write tools (create, update) ───────────────────────────────────────────────

function registerBlogWriteTools(server: McpServer, client: SapoClient): void {
  server.registerTool(
    'create_blog',
    {
      description:
        'Create a new blog. For SEO/content team: set title, handle (URL slug), ' +
        'and comment policy. Articles are added via create_article.',
      inputSchema: {
        title: z.string().describe('Blog title. Required.'),
        handle: z
          .string()
          .optional()
          .describe('URL handle/slug (auto-generated from title if omitted).'),
        commentable: z
          .enum(['no', 'moderate', 'yes'])
          .optional()
          .describe('Comment policy: no (disabled), moderate (approval required), yes (open).'),
        tags: z.string().optional().describe('Comma-separated tags for the blog.'),
      },
    },
    async (args) => {
      const body: Record<string, unknown> = { title: args.title };
      if (args.handle !== undefined) body.handle = args.handle;
      if (args.commentable !== undefined) body.commentable = args.commentable;
      if (args.tags !== undefined) body.tags = args.tags;

      const raw = await client.post('/blogs.json', { blog: body });
      const parsed = BlogSingleResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: create blog');
      return okResponse(parsed.data.blog);
    },
  );

  server.registerTool(
    'update_blog',
    {
      description:
        'Update a blog. For SEO/content team: rename, change handle/slug, or adjust comment policy.',
      inputSchema: {
        blog_id: z.number().int().describe('Blog ID to update. Required.'),
        title: z.string().optional().describe('New blog title.'),
        handle: z.string().optional().describe('New URL handle/slug.'),
        commentable: z.enum(['no', 'moderate', 'yes']).optional().describe('New comment policy.'),
        tags: z.string().optional().describe('New comma-separated tags.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const body: Record<string, unknown> = {};
        if (args.title !== undefined) body.title = args.title;
        if (args.handle !== undefined) body.handle = args.handle;
        if (args.commentable !== undefined) body.commentable = args.commentable;
        if (args.tags !== undefined) body.tags = args.tags;

        const raw = await client.put(`/blogs/${args.blog_id}.json`, { blog: body });
        const parsed = BlogSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: update blog');
        return okResponse(parsed.data.blog);
      }, 'Blog');
    },
  );
}

// ── Destructive tools (delete) ─────────────────────────────────────────────────

function registerBlogDestructiveTools(
  server: McpServer,
  client: SapoClient,
  ctx: GuardContext,
): void {
  registerIfAllowed(
    server,
    {
      name: 'delete_blog',
      category: 'delete',
      description:
        '[DESTRUCTIVE: delete] Permanently delete a blog and all its articles. Cannot be undone. ' +
        'WARNING: all articles within the blog are also deleted. ' +
        'Requires SAPO_ALLOW_OPS=delete AND confirm:true.',
      inputSchema: {
        confirm: z
          .literal(true)
          .describe('Must be true. Explicit confirmation required for destructive operations.'),
        blog_id: z.number().int().describe('Blog ID to delete. Required.'),
      },
      handler: async (args) => {
        return handleNotFound(async () => {
          await client.delete(`/blogs/${args.blog_id}.json`);
          return okResponse({ deleted: true, id: args.blog_id });
        }, 'Blog');
      },
    },
    ctx,
  );
}

// ── Main register function ─────────────────────────────────────────────────────

export function registerBlogTools(server: McpServer, client: SapoClient, ctx: GuardContext): void {
  registerBlogReadTools(server, client);
  registerBlogWriteTools(server, client);
  registerBlogDestructiveTools(server, client, ctx);
}
