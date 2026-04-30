/**
 * Tests for registerBlogTools — blogs read, write, destructive.
 *
 * Tools tested:
 *   list_blogs, get_blog,
 *   create_blog, update_blog,
 *   delete_blog (destructive, gated)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import type { GuardContext } from '../../src/guards.js';
import { registerBlogTools } from '../../src/tools/blogs.js';

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

const blog = {
  id: 10001,
  title: 'Tin tức & Sự kiện',
  handle: 'tin-tuc-su-kien',
  commentable: 'moderate',
  tags: 'news,events',
  created_on: '2026-01-10T08:00:00Z',
  modified_on: '2026-04-01T09:00:00Z',
};

describe('registerBlogTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerBlogTools(server, client, makeCtx(true));
  });

  // ── Tool registration ───────────────────────────────────────────────────────

  it('registers all 5 blog tools when destructive allowed', () => {
    const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
      ._registeredTools;
    const expected = ['list_blogs', 'get_blog', 'create_blog', 'update_blog', 'delete_blog'];
    for (const name of expected) {
      expect(tools[name], `Tool "${name}" should be registered`).toBeDefined();
    }
  });

  it('does NOT register delete_blog when allowOps is empty', () => {
    const restrictedServer = makeServer();
    registerBlogTools(restrictedServer, client, makeCtx(false));
    const tools = (restrictedServer as unknown as { _registeredTools: Record<string, unknown> })
      ._registeredTools;
    expect(tools.delete_blog).toBeUndefined();
    expect(tools.list_blogs).toBeDefined();
    expect(tools.create_blog).toBeDefined();
  });

  // ── list_blogs ──────────────────────────────────────────────────────────────

  describe('list_blogs', () => {
    it('calls /blogs.json and returns paginated envelope', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ blogs: [blog] });

      const result = await callTool(server, 'list_blogs', { limit: 1 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith(
        '/blogs.json',
        expect.objectContaining({ params: expect.objectContaining({ limit: 1 }) }),
      );
      expect(text.data).toHaveLength(1);
      expect(text.has_more).toBe(true);
      expect(text.next_since_id).toBe(10001);
    });

    it('applies handle filter', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ blogs: [] });

      await callTool(server, 'list_blogs', { handle: 'tin-tuc' });
      expect(client.get).toHaveBeenCalledWith(
        '/blogs.json',
        expect.objectContaining({ params: expect.objectContaining({ handle: 'tin-tuc' }) }),
      );
    });

    it('returns has_more=false when results < limit', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ blogs: [blog] });

      const result = await callTool(server, 'list_blogs', { limit: 50 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.has_more).toBe(false);
      expect(text.next_since_id).toBeNull();
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ bad: 'data' });

      const result = await callTool(server, 'list_blogs', {});
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  // ── get_blog ────────────────────────────────────────────────────────────────

  describe('get_blog', () => {
    it('calls /blogs/{id}.json and returns blog', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ blog });

      const result = await callTool(server, 'get_blog', { blog_id: 10001 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/blogs/10001.json');
      expect(text.id).toBe(10001);
      expect(text.title).toBe('Tin tức & Sự kiện');
    });

    it('returns isError on SapoNotFoundError', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('Blog'));

      const result = await callTool(server, 'get_blog', { blog_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  // ── create_blog ─────────────────────────────────────────────────────────────

  describe('create_blog', () => {
    it('calls POST /blogs.json with blog body', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ blog });

      await callTool(server, 'create_blog', { title: 'Tin tức & Sự kiện' });

      expect(client.post).toHaveBeenCalledWith(
        '/blogs.json',
        expect.objectContaining({
          blog: expect.objectContaining({ title: 'Tin tức & Sự kiện' }),
        }),
      );
    });

    it('returns created blog', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ blog });

      const result = await callTool(server, 'create_blog', { title: 'New Blog' });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.id).toBe(10001);
    });

    it('includes handle and commentable when provided', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ blog });

      await callTool(server, 'create_blog', {
        title: 'New Blog',
        handle: 'new-blog',
        commentable: 'moderate',
      });

      expect(client.post).toHaveBeenCalledWith(
        '/blogs.json',
        expect.objectContaining({
          blog: expect.objectContaining({
            handle: 'new-blog',
            commentable: 'moderate',
          }),
        }),
      );
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ bad: 'data' });

      const result = await callTool(server, 'create_blog', { title: 'X' });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  // ── update_blog ─────────────────────────────────────────────────────────────

  describe('update_blog', () => {
    it('calls PUT /blogs/{id}.json with updated fields', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce({ blog });

      await callTool(server, 'update_blog', { blog_id: 10001, title: 'Updated Title' });

      expect(client.put).toHaveBeenCalledWith(
        '/blogs/10001.json',
        expect.objectContaining({
          blog: expect.objectContaining({ title: 'Updated Title' }),
        }),
      );
    });

    it('returns updated blog', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce({ blog });

      const result = await callTool(server, 'update_blog', { blog_id: 10001, title: 'X' });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.id).toBe(10001);
    });

    it('returns isError on SapoNotFoundError', async () => {
      vi.spyOn(client, 'put').mockRejectedValueOnce(new SapoNotFoundError('Blog'));

      const result = await callTool(server, 'update_blog', { blog_id: 9999, title: 'X' });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  // ── delete_blog ─────────────────────────────────────────────────────────────

  describe('delete_blog', () => {
    it('calls DELETE /blogs/{id}.json and returns deleted=true', async () => {
      vi.spyOn(client, 'delete').mockResolvedValueOnce(undefined);

      const result = await callTool(server, 'delete_blog', { confirm: true, blog_id: 10001 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.delete).toHaveBeenCalledWith('/blogs/10001.json');
      expect(text.deleted).toBe(true);
      expect(text.id).toBe(10001);
    });

    it('returns isError on SapoNotFoundError', async () => {
      vi.spyOn(client, 'delete').mockRejectedValueOnce(new SapoNotFoundError('Blog'));

      const result = await callTool(server, 'delete_blog', { confirm: true, blog_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });
});
