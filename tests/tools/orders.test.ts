/**
 * Tests for registerOrderTools — list_orders, get_order, count_orders, search_orders
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import { registerOrderTools } from '../../src/tools/orders.js';
import listFixture from '../fixtures/sapo/orders/list-response.json' with { type: 'json' };
import singleFixture from '../fixtures/sapo/orders/single.json' with { type: 'json' };

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

/** 2-order list for pagination testing */
const paginationFixture = {
  orders: [listFixture.orders[0], { ...listFixture.orders[0], id: 174107277 }],
};

describe('registerOrderTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerOrderTools(server, client);
  });

  describe('list_orders', () => {
    it('calls /orders.json and returns paginated envelope', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_orders', { limit: 50 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith(
        '/orders.json',
        expect.objectContaining({ params: expect.objectContaining({ limit: 50 }) }),
      );
      expect(text.data).toHaveLength(listFixture.orders.length);
      expect(text).toHaveProperty('has_more');
      expect(text).toHaveProperty('next_since_id');
    });

    it('returns has_more=false when items < limit', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_orders', { limit: 50 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.has_more).toBe(false);
      expect(text.next_since_id).toBeNull();
    });

    it('returns has_more=true and next_since_id when at limit', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(paginationFixture);

      const result = await callTool(server, 'list_orders', { limit: 2 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.has_more).toBe(true);
      expect(text.next_since_id).toBe(174107277);
    });

    it('passes status filter param', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ orders: [] });

      await callTool(server, 'list_orders', { status: 'open' });
      expect(client.get).toHaveBeenCalledWith(
        '/orders.json',
        expect.objectContaining({ params: expect.objectContaining({ status: 'open' }) }),
      );
    });

    it('passes financial_status filter param', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ orders: [] });

      await callTool(server, 'list_orders', { financial_status: 'pending' });
      expect(client.get).toHaveBeenCalledWith(
        '/orders.json',
        expect.objectContaining({
          params: expect.objectContaining({ financial_status: 'pending' }),
        }),
      );
    });

    it('passes source_name filter param', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ orders: [] });

      await callTool(server, 'list_orders', { source_name: 'facebook' });
      expect(client.get).toHaveBeenCalledWith(
        '/orders.json',
        expect.objectContaining({
          params: expect.objectContaining({ source_name: 'facebook' }),
        }),
      );
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ invalid: true });

      const result = await callTool(server, 'list_orders', {});
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  describe('get_order', () => {
    it('calls /orders/{id}.json and returns order data', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(singleFixture);

      const result = await callTool(server, 'get_order', { order_id: 174107276 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/orders/174107276.json');
      expect(text.id).toBe(174107276);
      expect(text.financial_status).toBe('pending');
    });

    it('returns isError:true on SapoNotFoundError', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('Order'));

      const result = await callTool(server, 'get_order', { order_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
      expect((result as { content: Array<{ text: string }> }).content[0].text).toContain(
        'not found',
      );
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ invalid: true });

      const result = await callTool(server, 'get_order', { order_id: 1 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  describe('count_orders', () => {
    it('calls /orders/count.json and returns count', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ count: 5 });

      const result = await callTool(server, 'count_orders', {});
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith(
        '/orders/count.json',
        expect.objectContaining({ params: {} }),
      );
      expect(text.count).toBe(5);
    });

    it('passes status filter to count endpoint', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ count: 3 });

      await callTool(server, 'count_orders', { status: 'open', financial_status: 'paid' });
      expect(client.get).toHaveBeenCalledWith(
        '/orders/count.json',
        expect.objectContaining({
          params: expect.objectContaining({ status: 'open', financial_status: 'paid' }),
        }),
      );
    });
  });

  describe('search_orders', () => {
    it('calls /orders.json with name param', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      await callTool(server, 'search_orders', { name: '#1001' });
      expect(client.get).toHaveBeenCalledWith(
        '/orders.json',
        expect.objectContaining({ params: expect.objectContaining({ name: '#1001' }) }),
      );
    });

    it('calls /orders.json with email param', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ orders: [] });

      await callTool(server, 'search_orders', { email: 'test@example.com' });
      expect(client.get).toHaveBeenCalledWith(
        '/orders.json',
        expect.objectContaining({
          params: expect.objectContaining({ email: 'test@example.com' }),
        }),
      );
    });

    it('returns paginated envelope', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'search_orders', { name: '#1001' });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text).toHaveProperty('data');
      expect(text).toHaveProperty('has_more');
      expect(text).toHaveProperty('next_since_id');
    });
  });

  describe('update_order', () => {
    it('PUTs /orders/{id}.json with provided fields only', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce(singleFixture);

      await callTool(server, 'update_order', {
        order_id: 1001,
        tags: 'vip,paid',
        note: 'updated via MCP',
      });

      expect(client.put).toHaveBeenCalledWith(
        '/orders/1001.json',
        expect.objectContaining({
          order: expect.objectContaining({ tags: 'vip,paid', note: 'updated via MCP' }),
        }),
      );
    });

    it('passes note_attributes array verbatim', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce(singleFixture);
      await callTool(server, 'update_order', {
        order_id: 1001,
        note_attributes: [{ name: 'src', value: 'mcp' }],
      });
      expect(client.put).toHaveBeenCalledWith(
        '/orders/1001.json',
        expect.objectContaining({
          order: { note_attributes: [{ name: 'src', value: 'mcp' }] },
        }),
      );
    });

    it('returns isError when order not found', async () => {
      vi.spyOn(client, 'put').mockRejectedValueOnce(new SapoNotFoundError('Order'));
      const result = await callTool(server, 'update_order', {
        order_id: 999999,
        tags: 'x',
      });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });
});
