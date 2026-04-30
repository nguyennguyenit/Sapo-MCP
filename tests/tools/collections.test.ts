/**
 * Tests for registerCollectionTools — custom collections, smart collections, collects
 *
 * Tools tested:
 *   list_custom_collections, get_custom_collection, create_custom_collection,
 *   update_custom_collection, delete_custom_collection (destructive, gated),
 *   list_smart_collections, get_smart_collection,
 *   list_collects, create_collect, delete_collect (destructive, gated)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import type { GuardContext } from '../../src/guards.js';
import { registerCollectionTools } from '../../src/tools/collections.js';

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

const customCollection = {
  id: 100001,
  title: 'Bộ sưu tập nổi bật',
  alias: 'bo-suu-tap-noi-bat',
  body_html: '<p>Mô tả</p>',
  sort_order: 'manual',
  published: true,
  created_on: '2026-01-15T10:00:00Z',
  modified_on: '2026-04-01T08:00:00Z',
};

const smartCollection = {
  id: 200001,
  title: 'Sản phẩm giảm giá',
  alias: 'san-pham-giam-gia',
  body_html: '<p>Sản phẩm đang giảm giá</p>',
  sort_order: 'best-selling',
  disjunctive: false,
  rules: [{ column: 'tag', relation: 'equals', condition: 'sale' }],
  published: true,
  created_on: '2026-02-01T09:00:00Z',
  modified_on: '2026-04-10T12:00:00Z',
};

const collect = {
  id: 300001,
  collection_id: 100001,
  product_id: 46419129,
  position: 1,
  created_on: '2026-03-01T07:00:00Z',
  modified_on: '2026-03-15T10:30:00Z',
};

describe('registerCollectionTools', () => {
  let server: McpServer;
  let client: SapoClient;
  let ctx: GuardContext;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    ctx = makeCtx(true); // allow all destructive for testing
    registerCollectionTools(server, client, ctx);
  });

  // ── Tool registration checks ────────────────────────────────────────────────

  it('registers all 10 collection tools when destructive allowed', () => {
    const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
      ._registeredTools;
    const expectedTools = [
      'list_custom_collections',
      'get_custom_collection',
      'create_custom_collection',
      'update_custom_collection',
      'delete_custom_collection',
      'list_smart_collections',
      'get_smart_collection',
      'list_collects',
      'create_collect',
      'delete_collect',
    ];
    for (const name of expectedTools) {
      expect(tools[name], `Tool "${name}" should be registered`).toBeDefined();
    }
  });

  it('does NOT register destructive tools when allowOps is empty', () => {
    const restrictedServer = makeServer();
    const restrictedCtx = makeCtx(false);
    registerCollectionTools(restrictedServer, client, restrictedCtx);

    const tools = (restrictedServer as unknown as { _registeredTools: Record<string, unknown> })
      ._registeredTools;
    expect(tools.delete_custom_collection).toBeUndefined();
    expect(tools.delete_collect).toBeUndefined();
    // Non-destructive tools should still be registered
    expect(tools.list_custom_collections).toBeDefined();
    expect(tools.create_custom_collection).toBeDefined();
  });

  // ── list_custom_collections ─────────────────────────────────────────────────

  describe('list_custom_collections', () => {
    it('calls /custom_collections.json and returns paginated envelope', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ custom_collections: [customCollection] });

      const result = await callTool(server, 'list_custom_collections', { limit: 1 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith(
        '/custom_collections.json',
        expect.objectContaining({ params: expect.objectContaining({ limit: 1 }) }),
      );
      expect(text.data).toHaveLength(1);
      expect(text.has_more).toBe(true);
      expect(text.next_since_id).toBe(100001);
    });

    it('applies title filter', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ custom_collections: [] });

      await callTool(server, 'list_custom_collections', { title: 'Nổi bật' });
      expect(client.get).toHaveBeenCalledWith(
        '/custom_collections.json',
        expect.objectContaining({ params: expect.objectContaining({ title: 'Nổi bật' }) }),
      );
    });

    it('returns has_more=false when results < limit', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ custom_collections: [customCollection] });

      const result = await callTool(server, 'list_custom_collections', { limit: 50 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.has_more).toBe(false);
      expect(text.next_since_id).toBeNull();
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ bad: 'response' });

      const result = await callTool(server, 'list_custom_collections', {});
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  // ── get_custom_collection ───────────────────────────────────────────────────

  describe('get_custom_collection', () => {
    it('calls /custom_collections/{id}.json and returns collection', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ custom_collection: customCollection });

      const result = await callTool(server, 'get_custom_collection', { collection_id: 100001 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/custom_collections/100001.json');
      expect(text.id).toBe(100001);
      expect(text.title).toBe('Bộ sưu tập nổi bật');
    });

    it('returns isError on SapoNotFoundError', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('CustomCollection'));

      const result = await callTool(server, 'get_custom_collection', { collection_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  // ── create_custom_collection ────────────────────────────────────────────────

  describe('create_custom_collection', () => {
    it('calls POST /custom_collections.json with body', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ custom_collection: customCollection });

      await callTool(server, 'create_custom_collection', {
        title: 'Bộ sưu tập nổi bật',
        sort_order: 'manual',
        published: true,
      });

      expect(client.post).toHaveBeenCalledWith(
        '/custom_collections.json',
        expect.objectContaining({
          custom_collection: expect.objectContaining({ title: 'Bộ sưu tập nổi bật' }),
        }),
      );
    });

    it('returns created collection', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ custom_collection: customCollection });

      const result = await callTool(server, 'create_custom_collection', { title: 'New' });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.id).toBe(100001);
    });

    it('includes seo fields when provided', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ custom_collection: customCollection });

      await callTool(server, 'create_custom_collection', {
        title: 'New',
        seo_title: 'SEO Title',
        seo_description: 'SEO Desc',
      });

      expect(client.post).toHaveBeenCalledWith(
        '/custom_collections.json',
        expect.objectContaining({
          custom_collection: expect.objectContaining({
            seo_title: 'SEO Title',
            seo_description: 'SEO Desc',
          }),
        }),
      );
    });
  });

  // ── update_custom_collection ────────────────────────────────────────────────

  describe('update_custom_collection', () => {
    it('calls PUT /custom_collections/{id}.json', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce({ custom_collection: customCollection });

      await callTool(server, 'update_custom_collection', {
        collection_id: 100001,
        title: 'Updated Title',
      });

      expect(client.put).toHaveBeenCalledWith(
        '/custom_collections/100001.json',
        expect.objectContaining({
          custom_collection: expect.objectContaining({ title: 'Updated Title' }),
        }),
      );
    });

    it('returns isError on SapoNotFoundError', async () => {
      vi.spyOn(client, 'put').mockRejectedValueOnce(new SapoNotFoundError('CustomCollection'));

      const result = await callTool(server, 'update_custom_collection', {
        collection_id: 9999,
        title: 'X',
      });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  // ── delete_custom_collection ────────────────────────────────────────────────

  describe('delete_custom_collection', () => {
    it('calls DELETE /custom_collections/{id}.json and returns deleted=true', async () => {
      vi.spyOn(client, 'delete').mockResolvedValueOnce(undefined);

      const result = await callTool(server, 'delete_custom_collection', {
        confirm: true,
        collection_id: 100001,
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.delete).toHaveBeenCalledWith('/custom_collections/100001.json');
      expect(text.deleted).toBe(true);
      expect(text.id).toBe(100001);
    });

    it('returns isError on SapoNotFoundError', async () => {
      vi.spyOn(client, 'delete').mockRejectedValueOnce(new SapoNotFoundError('CustomCollection'));

      const result = await callTool(server, 'delete_custom_collection', {
        confirm: true,
        collection_id: 9999,
      });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  // ── list_smart_collections ──────────────────────────────────────────────────

  describe('list_smart_collections', () => {
    it('calls /smart_collections.json and returns paginated envelope', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ smart_collections: [smartCollection] });

      const result = await callTool(server, 'list_smart_collections', { limit: 1 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith(
        '/smart_collections.json',
        expect.objectContaining({ params: expect.objectContaining({ limit: 1 }) }),
      );
      expect(text.data).toHaveLength(1);
      expect(text.has_more).toBe(true);
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ bad: 'data' });

      const result = await callTool(server, 'list_smart_collections', {});
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  // ── get_smart_collection ────────────────────────────────────────────────────

  describe('get_smart_collection', () => {
    it('calls /smart_collections/{id}.json and returns collection with rules', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ smart_collection: smartCollection });

      const result = await callTool(server, 'get_smart_collection', { collection_id: 200001 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/smart_collections/200001.json');
      expect(text.id).toBe(200001);
      expect(text.rules).toHaveLength(1);
    });

    it('returns isError on SapoNotFoundError', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('SmartCollection'));

      const result = await callTool(server, 'get_smart_collection', { collection_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  // ── list_collects ───────────────────────────────────────────────────────────

  describe('list_collects', () => {
    it('calls /collects.json and returns paginated envelope', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ collects: [collect] });

      const result = await callTool(server, 'list_collects', { limit: 1 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith(
        '/collects.json',
        expect.objectContaining({ params: expect.objectContaining({ limit: 1 }) }),
      );
      expect(text.data).toHaveLength(1);
    });

    it('filters by collection_id', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ collects: [] });

      await callTool(server, 'list_collects', { collection_id: 100001 });
      expect(client.get).toHaveBeenCalledWith(
        '/collects.json',
        expect.objectContaining({
          params: expect.objectContaining({ collection_id: 100001 }),
        }),
      );
    });

    it('filters by product_id', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ collects: [] });

      await callTool(server, 'list_collects', { product_id: 46419129 });
      expect(client.get).toHaveBeenCalledWith(
        '/collects.json',
        expect.objectContaining({
          params: expect.objectContaining({ product_id: 46419129 }),
        }),
      );
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ bad: 'data' });

      const result = await callTool(server, 'list_collects', {});
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  // ── create_collect ──────────────────────────────────────────────────────────

  describe('create_collect', () => {
    it('calls POST /collects.json with collect body', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ collect });

      await callTool(server, 'create_collect', {
        collection_id: 100001,
        product_id: 46419129,
      });

      expect(client.post).toHaveBeenCalledWith(
        '/collects.json',
        expect.objectContaining({
          collect: expect.objectContaining({
            collection_id: 100001,
            product_id: 46419129,
          }),
        }),
      );
    });

    it('returns created collect', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ collect });

      const result = await callTool(server, 'create_collect', {
        collection_id: 100001,
        product_id: 46419129,
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.id).toBe(300001);
      expect(text.collection_id).toBe(100001);
    });

    it('includes position when provided', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ collect });

      await callTool(server, 'create_collect', {
        collection_id: 100001,
        product_id: 46419129,
        position: 5,
      });

      expect(client.post).toHaveBeenCalledWith(
        '/collects.json',
        expect.objectContaining({
          collect: expect.objectContaining({ position: 5 }),
        }),
      );
    });
  });

  // ── delete_collect ──────────────────────────────────────────────────────────

  describe('delete_collect', () => {
    it('calls DELETE /collects/{id}.json and returns deleted=true', async () => {
      vi.spyOn(client, 'delete').mockResolvedValueOnce(undefined);

      const result = await callTool(server, 'delete_collect', {
        confirm: true,
        collect_id: 300001,
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.delete).toHaveBeenCalledWith('/collects/300001.json');
      expect(text.deleted).toBe(true);
      expect(text.id).toBe(300001);
    });

    it('returns isError on SapoNotFoundError', async () => {
      vi.spyOn(client, 'delete').mockRejectedValueOnce(new SapoNotFoundError('Collect'));

      const result = await callTool(server, 'delete_collect', {
        confirm: true,
        collect_id: 9999,
      });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });
});
