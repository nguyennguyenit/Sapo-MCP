/**
 * Article tools for web mode (SEO/content team persona).
 * Registers: list_articles, get_article (R)
 *            create_article, update_article (S)
 *            delete_article (D — gated via SAPO_ALLOW_OPS=delete + confirm:true)
 *
 * IMPORTANT: Article body_html is raw HTML. No sanitization is performed here.
 * The storefront/renderer is responsible for XSS prevention.
 *
 * Endpoints:
 *   GET    /admin/blogs/{blog_id}/articles.json
 *   GET    /admin/articles.json                   (cross-blog list)
 *   GET    /admin/blogs/{blog_id}/articles/{id}.json
 *   POST   /admin/blogs/{blog_id}/articles.json
 *   PUT    /admin/blogs/{blog_id}/articles/{id}.json
 *   DELETE /admin/blogs/{blog_id}/articles/{id}.json
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import type { GuardContext } from '../guards.js';
import { registerIfAllowed } from '../guards.js';
import { ArticleListResponseSchema, ArticleSingleResponseSchema } from '../schemas/article.js';
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

function registerArticleReadTools(server: McpServer, client: SapoClient): void {
  server.registerTool(
    'list_articles',
    {
      description:
        'List articles within a specific blog. For SEO/content team: browse articles to review ' +
        'SEO metadata, published status, and tags. Paginated via since_id cursor. ' +
        'Requires blog_id — use list_blogs to find it.',
      inputSchema: {
        blog_id: z.number().int().describe('Blog ID to list articles from. Required.'),
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
          .describe('Return articles with ID greater than this value (cursor pagination).'),
        published_status: z
          .enum(['published', 'unpublished', 'any'])
          .optional()
          .describe('Filter by published status (default: any).'),
        tag: z.string().optional().describe('Filter articles by tag.'),
        author: z.string().optional().describe('Filter articles by author name.'),
      },
    },
    async (args) => {
      const limit = args.limit ?? 50;
      const params: Record<string, string | number | undefined> = { limit };
      if (args.since_id !== undefined) params.since_id = args.since_id;
      if (args.published_status) params.published_status = args.published_status;
      if (args.tag) params.tag = args.tag;
      if (args.author) params.author = args.author;

      const raw = await client.get(`/blogs/${args.blog_id}/articles.json`, { params });
      const parsed = ArticleListResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: articles list');
      return okResponse(buildEnvelope(parsed.data.articles, limit));
    },
  );

  server.registerTool(
    'get_article',
    {
      description:
        'Get a single article by ID within a blog. Returns full HTML body, SEO fields, ' +
        'tags, author, and published status.',
      inputSchema: {
        blog_id: z.number().int().describe('Blog ID that contains the article. Required.'),
        article_id: z.number().int().describe('Article ID. Required.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const raw = await client.get(`/blogs/${args.blog_id}/articles/${args.article_id}.json`);
        const parsed = ArticleSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: article');
        return okResponse(parsed.data.article);
      }, 'Article');
    },
  );
}

// ── Write tools (create, update) ───────────────────────────────────────────────

function registerArticleWriteTools(server: McpServer, client: SapoClient): void {
  server.registerTool(
    'create_article',
    {
      description:
        'Create a new article within a blog. For SEO/content team: provide title, HTML body, ' +
        'seo_title, seo_description, tags, author, and published status. ' +
        "WARNING: body_html is accepted as-is (raw HTML). XSS prevention is the caller's responsibility.",
      inputSchema: {
        blog_id: z.number().int().describe('Blog ID to create article in. Required.'),
        title: z.string().describe('Article title. Required.'),
        body_html: z
          .string()
          .optional()
          .describe("HTML body content. Raw HTML — XSS prevention is caller's responsibility."),
        summary_html: z.string().optional().describe('HTML summary/excerpt for the article.'),
        author: z.string().optional().describe('Author name.'),
        tags: z.string().optional().describe('Comma-separated tags.'),
        published: z.boolean().optional().describe('Whether article is published (default false).'),
        seo_title: z.string().optional().describe('SEO meta title override.'),
        seo_description: z.string().optional().describe('SEO meta description override.'),
        image_src: z.string().optional().describe('URL of article featured image.'),
      },
    },
    async (args) => {
      const body: Record<string, unknown> = { title: args.title };
      if (args.body_html !== undefined) body.body_html = args.body_html;
      if (args.summary_html !== undefined) body.summary_html = args.summary_html;
      if (args.author !== undefined) body.author = args.author;
      if (args.tags !== undefined) body.tags = args.tags;
      if (args.published !== undefined) body.published = args.published;
      if (args.seo_title !== undefined) body.seo_title = args.seo_title;
      if (args.seo_description !== undefined) body.seo_description = args.seo_description;
      if (args.image_src !== undefined) body.image = { src: args.image_src };

      const raw = await client.post(`/blogs/${args.blog_id}/articles.json`, { article: body });
      const parsed = ArticleSingleResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: create article');
      return okResponse(parsed.data.article);
    },
  );

  server.registerTool(
    'update_article',
    {
      description:
        'Update an existing article. For SEO/content team: update title, body, SEO fields, ' +
        'tags, author, or published status. ' +
        "WARNING: body_html is accepted as-is (raw HTML). XSS prevention is the caller's responsibility.",
      inputSchema: {
        blog_id: z.number().int().describe('Blog ID that contains the article. Required.'),
        article_id: z.number().int().describe('Article ID to update. Required.'),
        title: z.string().optional().describe('New article title.'),
        body_html: z
          .string()
          .optional()
          .describe("New HTML body. Raw HTML — XSS prevention is caller's responsibility."),
        summary_html: z.string().optional().describe('New HTML summary/excerpt.'),
        author: z.string().optional().describe('New author name.'),
        tags: z.string().optional().describe('New comma-separated tags.'),
        published: z.boolean().optional().describe('Publish or unpublish the article.'),
        seo_title: z.string().optional().describe('New SEO meta title override.'),
        seo_description: z.string().optional().describe('New SEO meta description override.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const body: Record<string, unknown> = {};
        if (args.title !== undefined) body.title = args.title;
        if (args.body_html !== undefined) body.body_html = args.body_html;
        if (args.summary_html !== undefined) body.summary_html = args.summary_html;
        if (args.author !== undefined) body.author = args.author;
        if (args.tags !== undefined) body.tags = args.tags;
        if (args.published !== undefined) body.published = args.published;
        if (args.seo_title !== undefined) body.seo_title = args.seo_title;
        if (args.seo_description !== undefined) body.seo_description = args.seo_description;

        const raw = await client.put(`/blogs/${args.blog_id}/articles/${args.article_id}.json`, {
          article: body,
        });
        const parsed = ArticleSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: update article');
        return okResponse(parsed.data.article);
      }, 'Article');
    },
  );
}

// ── Destructive tools (delete) ─────────────────────────────────────────────────

function registerArticleDestructiveTools(
  server: McpServer,
  client: SapoClient,
  ctx: GuardContext,
): void {
  registerIfAllowed(
    server,
    {
      name: 'delete_article',
      category: 'delete',
      description:
        '[DESTRUCTIVE: delete] Permanently delete an article from a blog. Cannot be undone. ' +
        'Requires SAPO_ALLOW_OPS=delete AND confirm:true.',
      inputSchema: {
        confirm: z
          .literal(true)
          .describe('Must be true. Explicit confirmation required for destructive operations.'),
        blog_id: z.number().int().describe('Blog ID that contains the article. Required.'),
        article_id: z.number().int().describe('Article ID to delete. Required.'),
      },
      handler: async (args) => {
        return handleNotFound(async () => {
          await client.delete(`/blogs/${args.blog_id}/articles/${args.article_id}.json`);
          return okResponse({ deleted: true, id: args.article_id });
        }, 'Article');
      },
    },
    ctx,
  );
}

// ── Main register function ─────────────────────────────────────────────────────

export function registerArticleTools(
  server: McpServer,
  client: SapoClient,
  ctx: GuardContext,
): void {
  registerArticleReadTools(server, client);
  registerArticleWriteTools(server, client);
  registerArticleDestructiveTools(server, client, ctx);
}
