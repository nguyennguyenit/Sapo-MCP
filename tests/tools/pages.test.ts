/**
 * Tests for registerPageTools — pages read, SEO update, destructive.
 *
 * Tools tested:
 *   list_pages, get_page,
 *   update_page_seo (SEO-only fields, strict subset),
 *   delete_page (destructive, gated)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import type { GuardContext } from '../../src/guards.js';
import { registerPageTools } from '../../src/tools/pages.js';

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

const page = {
  id: 30001,
  title: 'Giới thiệu về chúng tôi',
  handle: 'gioi-thieu',
  body_html: '<h1>Về chúng tôi</h1>',
  published: true,
  meta_title: 'Về chúng tôi | Shop',
  meta_description: 'Tìm hiểu câu chuyện của chúng tôi.',
  tags: 'about,company',
  created_on: '2026-01-05T07:00:00Z',
  modified_on: '2026-03-20T11:00:00Z',
};

describe('registerPageTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerPageTools(server, client, makeCtx(true));
  });

  // ── Tool registration ───────────────────────────────────────────────────────

  it('registers all 4 page tools when destructive allowed', () => {
    const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
      ._registeredTools;
    const expected = ['list_pages', 'get_page', 'update_page_seo', 'delete_page'];
    for (const name of expected) {
      expect(tools[name], `Tool "${name}" should be registered`).toBeDefined();
    }
  });

  it('does NOT register delete_page when allowOps is empty', () => {
    const restrictedServer = makeServer();
    registerPageTools(restrictedServer, client, makeCtx(false));
    const tools = (restrictedServer as unknown as { _registeredTools: Record<string, unknown> })
      ._registeredTools;
    expect(tools.delete_page).toBeUndefined();
    expect(tools.list_pages).toBeDefined();
    expect(tools.update_page_seo).toBeDefined();
  });

  // ── list_pages ──────────────────────────────────────────────────────────────

  describe('list_pages', () => {
    it('calls /pages.json and returns paginated envelope', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ pages: [page] });

      const result = await callTool(server, 'list_pages', { limit: 1 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith(
        '/pages.json',
        expect.objectContaining({ params: expect.objectContaining({ limit: 1 }) }),
      );
      expect(text.data).toHaveLength(1);
      expect(text.has_more).toBe(true);
      expect(text.next_since_id).toBe(30001);
    });

    it('applies title filter', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ pages: [] });

      await callTool(server, 'list_pages', { title: 'Giới thiệu' });
      expect(client.get).toHaveBeenCalledWith(
        '/pages.json',
        expect.objectContaining({ params: expect.objectContaining({ title: 'Giới thiệu' }) }),
      );
    });

    it('applies handle filter', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ pages: [] });

      await callTool(server, 'list_pages', { handle: 'gioi-thieu' });
      expect(client.get).toHaveBeenCalledWith(
        '/pages.json',
        expect.objectContaining({ params: expect.objectContaining({ handle: 'gioi-thieu' }) }),
      );
    });

    it('applies published_status filter', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ pages: [] });

      await callTool(server, 'list_pages', { published_status: 'unpublished' });
      expect(client.get).toHaveBeenCalledWith(
        '/pages.json',
        expect.objectContaining({
          params: expect.objectContaining({ published_status: 'unpublished' }),
        }),
      );
    });

    it('returns has_more=false when results < limit', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ pages: [page] });

      const result = await callTool(server, 'list_pages', { limit: 50 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.has_more).toBe(false);
      expect(text.next_since_id).toBeNull();
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ bad: 'data' });

      const result = await callTool(server, 'list_pages', {});
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  // ── get_page ────────────────────────────────────────────────────────────────

  describe('get_page', () => {
    it('calls /pages/{id}.json and returns page', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ page });

      const result = await callTool(server, 'get_page', { page_id: 30001 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/pages/30001.json');
      expect(text.id).toBe(30001);
      expect(text.title).toBe('Giới thiệu về chúng tôi');
    });

    it('returns isError on SapoNotFoundError', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('Page'));

      const result = await callTool(server, 'get_page', { page_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  // ── update_page_seo ─────────────────────────────────────────────────────────

  describe('update_page_seo', () => {
    it('calls PUT /pages/{id}.json with only SEO fields', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce({ page });

      await callTool(server, 'update_page_seo', {
        page_id: 30001,
        meta_title: 'New SEO Title',
        meta_description: 'New meta description',
        handle: 'new-slug',
        tags: 'seo,updated',
        published: true,
      });

      expect(client.put).toHaveBeenCalledWith(
        '/pages/30001.json',
        expect.objectContaining({
          page: expect.objectContaining({
            meta_title: 'New SEO Title',
            meta_description: 'New meta description',
            handle: 'new-slug',
            tags: 'seo,updated',
            published: true,
          }),
        }),
      );
    });

    it('does NOT send body_html or title in the PUT request', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce({ page });

      await callTool(server, 'update_page_seo', {
        page_id: 30001,
        meta_title: 'SEO Only',
      });

      const putCall = vi.mocked(client.put).mock.calls[0];
      const sentBody = putCall[1] as { page: Record<string, unknown> };
      expect(sentBody.page.body_html).toBeUndefined();
      expect(sentBody.page.title).toBeUndefined();
      expect(sentBody.page.author).toBeUndefined();
    });

    it('returns updated page', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce({ page });

      const result = await callTool(server, 'update_page_seo', {
        page_id: 30001,
        meta_title: 'SEO Title',
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.id).toBe(30001);
    });

    it('sends only provided fields (no undefined keys in payload)', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce({ page });

      await callTool(server, 'update_page_seo', {
        page_id: 30001,
        published: false,
      });

      const putCall = vi.mocked(client.put).mock.calls[0];
      const sentBody = putCall[1] as { page: Record<string, unknown> };
      expect(sentBody.page).toEqual({ published: false });
    });

    it('returns isError on SapoNotFoundError', async () => {
      vi.spyOn(client, 'put').mockRejectedValueOnce(new SapoNotFoundError('Page'));

      const result = await callTool(server, 'update_page_seo', {
        page_id: 9999,
        meta_title: 'X',
      });
      expect((result as { isError: boolean }).isError).toBe(true);
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce({ bad: 'data' });

      const result = await callTool(server, 'update_page_seo', {
        page_id: 30001,
        meta_title: 'X',
      });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  // ── delete_page ─────────────────────────────────────────────────────────────

  describe('delete_page', () => {
    it('calls DELETE /pages/{id}.json and returns deleted=true', async () => {
      vi.spyOn(client, 'delete').mockResolvedValueOnce(undefined);

      const result = await callTool(server, 'delete_page', { confirm: true, page_id: 30001 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.delete).toHaveBeenCalledWith('/pages/30001.json');
      expect(text.deleted).toBe(true);
      expect(text.id).toBe(30001);
    });

    it('returns isError on SapoNotFoundError', async () => {
      vi.spyOn(client, 'delete').mockRejectedValueOnce(new SapoNotFoundError('Page'));

      const result = await callTool(server, 'delete_page', { confirm: true, page_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });
});
