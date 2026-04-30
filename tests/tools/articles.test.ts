/**
 * Tests for registerArticleTools — articles read, write, destructive.
 *
 * Tools tested:
 *   list_articles, get_article,
 *   create_article, update_article,
 *   delete_article (destructive, gated)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import type { GuardContext } from '../../src/guards.js';
import { registerArticleTools } from '../../src/tools/articles.js';

function makeServer(): McpServer {
  return new McpServer({ name: 'test', version: '0.0.0' });
}

function makeClient(): SapoClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
    buildUrl: vi.fn(),
  } as unknown as SapoClient;
}

function makeCtx(allowAll = false): GuardContext {
  return {
    allowOps: allowAll ? new Set(['*' as const]) : new Set(),
  };
}

async function callTool(server: McpServer, name: string, args: Record<string, unknown>) {
  const tools = (
    server as unknown as {
      _registeredTools: Record<string, { handler: (args: unknown) => Promise<unknown> }>;
    }
  )._registeredTools;
  const tool = tools[name];
  if (!tool) throw new Error(`Tool not registered: ${name}`);
  return tool.handler(args);
}

// ── Fixtures ────────────────────────────────────────────────────────────────────

const article = {
  id: 20001,
  blog_id: 10001,
  title: 'Hướng dẫn mua sắm online',
  body_html: '<p>Nội dung chi tiết</p>',
  author: 'Nguyễn Văn A',
  handle: 'huong-dan-mua-sam-online',
  tags: 'guide,shopping',
  published: true,
  created_on: '2026-02-01T08:00:00Z',
  modified_on: '2026-04-10T10:00:00Z',
};

describe('registerArticleTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerArticleTools(server, client, makeCtx(true));
  });

  // ── Tool registration ───────────────────────────────────────────────────────

  it('registers all 5 article tools when destructive allowed', () => {
    const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
      ._registeredTools;
    const expected = [
      'list_articles',
      'get_article',
      'create_article',
      'update_article',
      'delete_article',
    ];
    for (const name of expected) {
      expect(tools[name], `Tool "${name}" should be registered`).toBeDefined();
    }
  });

  it('does NOT register delete_article when allowOps is empty', () => {
    const restrictedServer = makeServer();
    registerArticleTools(restrictedServer, client, makeCtx(false));
    const tools = (restrictedServer as unknown as { _registeredTools: Record<string, unknown> })
      ._registeredTools;
    expect(tools.delete_article).toBeUndefined();
    expect(tools.list_articles).toBeDefined();
    expect(tools.create_article).toBeDefined();
  });

  // ── list_articles ───────────────────────────────────────────────────────────

  describe('list_articles', () => {
    it('calls /blogs/{blog_id}/articles.json and returns paginated envelope', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ articles: [article] });

      const result = await callTool(server, 'list_articles', { blog_id: 10001, limit: 1 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith(
        '/blogs/10001/articles.json',
        expect.objectContaining({ params: expect.objectContaining({ limit: 1 }) }),
      );
      expect(text.data).toHaveLength(1);
      expect(text.has_more).toBe(true);
      expect(text.next_since_id).toBe(20001);
    });

    it('applies published_status filter', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ articles: [] });

      await callTool(server, 'list_articles', { blog_id: 10001, published_status: 'published' });
      expect(client.get).toHaveBeenCalledWith(
        '/blogs/10001/articles.json',
        expect.objectContaining({
          params: expect.objectContaining({ published_status: 'published' }),
        }),
      );
    });

    it('applies tag filter', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ articles: [] });

      await callTool(server, 'list_articles', { blog_id: 10001, tag: 'guide' });
      expect(client.get).toHaveBeenCalledWith(
        '/blogs/10001/articles.json',
        expect.objectContaining({ params: expect.objectContaining({ tag: 'guide' }) }),
      );
    });

    it('applies author filter', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ articles: [] });

      await callTool(server, 'list_articles', { blog_id: 10001, author: 'Nguyễn Văn A' });
      expect(client.get).toHaveBeenCalledWith(
        '/blogs/10001/articles.json',
        expect.objectContaining({
          params: expect.objectContaining({ author: 'Nguyễn Văn A' }),
        }),
      );
    });

    it('returns has_more=false when results < limit', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ articles: [article] });

      const result = await callTool(server, 'list_articles', { blog_id: 10001, limit: 50 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.has_more).toBe(false);
      expect(text.next_since_id).toBeNull();
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ bad: 'data' });

      const result = await callTool(server, 'list_articles', { blog_id: 10001 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  // ── get_article ─────────────────────────────────────────────────────────────

  describe('get_article', () => {
    it('calls /blogs/{blog_id}/articles/{id}.json and returns article', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ article });

      const result = await callTool(server, 'get_article', { blog_id: 10001, article_id: 20001 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/blogs/10001/articles/20001.json');
      expect(text.id).toBe(20001);
      expect(text.blog_id).toBe(10001);
    });

    it('returns isError on SapoNotFoundError', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('Article'));

      const result = await callTool(server, 'get_article', { blog_id: 10001, article_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  // ── create_article ──────────────────────────────────────────────────────────

  describe('create_article', () => {
    it('calls POST /blogs/{blog_id}/articles.json with article body', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ article });

      await callTool(server, 'create_article', {
        blog_id: 10001,
        title: 'Hướng dẫn mua sắm online',
        body_html: '<p>Content</p>',
        published: true,
      });

      expect(client.post).toHaveBeenCalledWith(
        '/blogs/10001/articles.json',
        expect.objectContaining({
          article: expect.objectContaining({
            title: 'Hướng dẫn mua sắm online',
            body_html: '<p>Content</p>',
            published: true,
          }),
        }),
      );
    });

    it('returns created article', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ article });

      const result = await callTool(server, 'create_article', {
        blog_id: 10001,
        title: 'New Article',
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.id).toBe(20001);
      expect(text.blog_id).toBe(10001);
    });

    it('includes seo fields when provided', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ article });

      await callTool(server, 'create_article', {
        blog_id: 10001,
        title: 'New',
        seo_title: 'SEO Title',
        seo_description: 'SEO Desc',
      });

      expect(client.post).toHaveBeenCalledWith(
        '/blogs/10001/articles.json',
        expect.objectContaining({
          article: expect.objectContaining({
            seo_title: 'SEO Title',
            seo_description: 'SEO Desc',
          }),
        }),
      );
    });

    it('wraps image_src in image object', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ article });

      await callTool(server, 'create_article', {
        blog_id: 10001,
        title: 'New',
        image_src: 'https://cdn.sapo.io/img.jpg',
      });

      expect(client.post).toHaveBeenCalledWith(
        '/blogs/10001/articles.json',
        expect.objectContaining({
          article: expect.objectContaining({
            image: { src: 'https://cdn.sapo.io/img.jpg' },
          }),
        }),
      );
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ bad: 'data' });

      const result = await callTool(server, 'create_article', { blog_id: 10001, title: 'X' });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  // ── update_article ──────────────────────────────────────────────────────────

  describe('update_article', () => {
    it('calls PUT /blogs/{blog_id}/articles/{id}.json with updated fields', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce({ article });

      await callTool(server, 'update_article', {
        blog_id: 10001,
        article_id: 20001,
        title: 'Updated Title',
        published: false,
      });

      expect(client.put).toHaveBeenCalledWith(
        '/blogs/10001/articles/20001.json',
        expect.objectContaining({
          article: expect.objectContaining({ title: 'Updated Title', published: false }),
        }),
      );
    });

    it('returns updated article', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce({ article });

      const result = await callTool(server, 'update_article', {
        blog_id: 10001,
        article_id: 20001,
        title: 'X',
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.id).toBe(20001);
    });

    it('returns isError on SapoNotFoundError', async () => {
      vi.spyOn(client, 'put').mockRejectedValueOnce(new SapoNotFoundError('Article'));

      const result = await callTool(server, 'update_article', {
        blog_id: 10001,
        article_id: 9999,
        title: 'X',
      });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  // ── delete_article ──────────────────────────────────────────────────────────

  describe('delete_article', () => {
    it('calls DELETE /blogs/{blog_id}/articles/{id}.json and returns deleted=true', async () => {
      vi.spyOn(client, 'delete').mockResolvedValueOnce(undefined);

      const result = await callTool(server, 'delete_article', {
        confirm: true,
        blog_id: 10001,
        article_id: 20001,
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.delete).toHaveBeenCalledWith('/blogs/10001/articles/20001.json');
      expect(text.deleted).toBe(true);
      expect(text.id).toBe(20001);
    });

    it('returns isError on SapoNotFoundError', async () => {
      vi.spyOn(client, 'delete').mockRejectedValueOnce(new SapoNotFoundError('Article'));

      const result = await callTool(server, 'delete_article', {
        confirm: true,
        blog_id: 10001,
        article_id: 9999,
      });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });
});
