/**
 * Tests for registerProductReadTools — list_products, get_product,
 * search_products, count_products
 *
 * Fixtures: real captured from store giapducthangscs (2026-04-30).
 * - list-response.json: 2 products (id: 46419129, 46419127)
 * - single.json: 1 product (id: 46419129, Sữa tắm Dove)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import { registerProductReadTools } from '../../src/tools/products-readonly.js';
import listFixture from '../fixtures/sapo/products/list-response.json' with { type: 'json' };
import singleFixture from '../fixtures/sapo/products/single.json' with { type: 'json' };

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

describe('registerProductReadTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerProductReadTools(server, client);
  });

  describe('list_products', () => {
    it('calls /products.json and returns paginated envelope', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_products', { limit: 2 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith(
        '/products.json',
        expect.objectContaining({ params: expect.objectContaining({ limit: 2 }) }),
      );
      // Real fixture: 2 products
      expect(text.data).toHaveLength(listFixture.products.length);
      expect(text.has_more).toBe(true);
    });

    it('filters by status param', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ products: [] });

      await callTool(server, 'list_products', { status: 'active' });
      expect(client.get).toHaveBeenCalledWith(
        '/products.json',
        expect.objectContaining({ params: expect.objectContaining({ status: 'active' }) }),
      );
    });

    it('returns next_since_id when has_more=true', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_products', { limit: 2 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      // next_since_id is the last product's id from the real fixture
      const lastProductId = listFixture.products[listFixture.products.length - 1].id;
      expect(text.next_since_id).toBe(lastProductId);
    });
  });

  describe('get_product', () => {
    it('calls /products/{id}.json and returns product', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(singleFixture);

      const realId = singleFixture.product.id;
      const result = await callTool(server, 'get_product', { product_id: realId });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith(`/products/${realId}.json`);
      expect(text.id).toBe(realId);
      // Sapo uses "name" not "title" — real fixture product name
      expect(text.name).toBe(singleFixture.product.name);
    });

    it('returns isError:true on SapoNotFoundError', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('Product'));

      const result = await callTool(server, 'get_product', { product_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  describe('search_products', () => {
    it('calls /products.json with title filter', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      await callTool(server, 'search_products', { title: 'Sữa tắm' });
      expect(client.get).toHaveBeenCalledWith(
        '/products.json',
        expect.objectContaining({ params: expect.objectContaining({ title: 'Sữa tắm' }) }),
      );
    });

    it('returns paginated envelope', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'search_products', { title: 'Test' });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text).toHaveProperty('data');
      expect(text).toHaveProperty('has_more');
    });
  });

  describe('count_products', () => {
    it('calls /products/count.json', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ count: 15 });

      const result = await callTool(server, 'count_products', {});
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/products/count.json', expect.any(Object));
      expect(text.count).toBe(15);
    });

    it('passes status filter', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ count: 10 });

      await callTool(server, 'count_products', { status: 'active' });
      expect(client.get).toHaveBeenCalledWith(
        '/products/count.json',
        expect.objectContaining({ params: expect.objectContaining({ status: 'active' }) }),
      );
    });
  });
});
