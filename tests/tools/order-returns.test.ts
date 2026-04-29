/**
 * Tests for registerOrderReturnTools:
 * list_order_returns, get_order_return, create_order_return, refund_order_return
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import { registerOrderReturnTools } from '../../src/tools/order-returns.js';
import listFixture from '../fixtures/sapo/order-returns/list-response.json' with { type: 'json' };

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

const syntheticReturn = {
  id: 9900001,
  order_id: 174107276,
  status: 'pending',
  note: 'Customer requested return',
  created_on: '2026-04-30T10:00:00Z',
  modified_on: '2026-04-30T10:00:00Z',
  line_items: [],
  restock: true,
};

const singleReturnResponse = { order_return: syntheticReturn };

/** 2-return list for pagination testing */
const paginationFixture = {
  order_returns: [syntheticReturn, { ...syntheticReturn, id: 9900002 }],
};

describe('registerOrderReturnTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerOrderReturnTools(server, client);
  });

  describe('list_order_returns', () => {
    it('calls /order_returns.json and returns paginated envelope', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_order_returns', { limit: 50 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith(
        '/order_returns.json',
        expect.objectContaining({ params: expect.objectContaining({ limit: 50 }) }),
      );
      expect(text).toHaveProperty('data');
      expect(text).toHaveProperty('has_more');
      expect(text).toHaveProperty('next_since_id');
    });

    it('returns empty data for empty list fixture', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_order_returns', {});
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.data).toHaveLength(0);
      expect(text.has_more).toBe(false);
      expect(text.next_since_id).toBeNull();
    });

    it('returns has_more=true when at limit', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(paginationFixture);

      const result = await callTool(server, 'list_order_returns', { limit: 2 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.has_more).toBe(true);
      expect(text.next_since_id).toBe(9900002);
    });

    it('passes order_id filter param', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      await callTool(server, 'list_order_returns', { order_id: 174107276 });
      expect(client.get).toHaveBeenCalledWith(
        '/order_returns.json',
        expect.objectContaining({
          params: expect.objectContaining({ order_id: 174107276 }),
        }),
      );
    });

    it('passes status filter param', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      await callTool(server, 'list_order_returns', { status: 'pending' });
      expect(client.get).toHaveBeenCalledWith(
        '/order_returns.json',
        expect.objectContaining({
          params: expect.objectContaining({ status: 'pending' }),
        }),
      );
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ invalid: true });

      const result = await callTool(server, 'list_order_returns', {});
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  describe('get_order_return', () => {
    it('calls /order_returns/{id}.json and returns return data', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(singleReturnResponse);

      const result = await callTool(server, 'get_order_return', { return_id: 9900001 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/order_returns/9900001.json');
      expect(text.id).toBe(9900001);
      expect(text.status).toBe('pending');
    });

    it('returns isError:true on SapoNotFoundError', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('OrderReturn'));

      const result = await callTool(server, 'get_order_return', { return_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  describe('create_order_return', () => {
    it('POSTs to /order_returns.json with wrapped body', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce(singleReturnResponse);

      await callTool(server, 'create_order_return', {
        order_id: 174107276,
        line_items: [{ line_item_id: 290320676, quantity: 1 }],
        note: 'Product damaged',
        restock: true,
      });

      expect(client.post).toHaveBeenCalledWith(
        '/order_returns.json',
        expect.objectContaining({
          order_return: expect.objectContaining({
            order_id: 174107276,
            line_items: expect.arrayContaining([
              expect.objectContaining({ line_item_id: 290320676, quantity: 1 }),
            ]),
            note: 'Product damaged',
            restock: true,
          }),
        }),
      );
    });

    it('returns the created order return', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce(singleReturnResponse);

      const result = await callTool(server, 'create_order_return', {
        order_id: 174107276,
        line_items: [{ line_item_id: 290320676, quantity: 1 }],
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.id).toBe(9900001);
      expect(text.order_id).toBe(174107276);
    });

    it('returns isError:true on SapoNotFoundError', async () => {
      vi.spyOn(client, 'post').mockRejectedValueOnce(new SapoNotFoundError('Order'));

      const result = await callTool(server, 'create_order_return', {
        order_id: 9999,
        line_items: [],
      });
      expect((result as { isError: boolean }).isError).toBe(true);
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ invalid: true });

      const result = await callTool(server, 'create_order_return', {
        order_id: 1,
        line_items: [],
      });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  describe('refund_order_return', () => {
    it('POSTs to /order_returns/{id}/refund.json', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce(singleReturnResponse);

      await callTool(server, 'refund_order_return', {
        return_id: 9900001,
        transactions: [{ amount: 150000, kind: 'refund' }],
        note: 'Approved refund',
      });

      expect(client.post).toHaveBeenCalledWith(
        '/order_returns/9900001/refund.json',
        expect.objectContaining({
          transactions: expect.any(Array),
          note: 'Approved refund',
        }),
      );
    });

    it('returns the refunded order return', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce(singleReturnResponse);

      const result = await callTool(server, 'refund_order_return', { return_id: 9900001 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.id).toBe(9900001);
    });

    it('returns isError:true on SapoNotFoundError', async () => {
      vi.spyOn(client, 'post').mockRejectedValueOnce(new SapoNotFoundError('OrderReturn'));

      const result = await callTool(server, 'refund_order_return', { return_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ invalid: true });

      const result = await callTool(server, 'refund_order_return', { return_id: 1 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });

    it('posts without body fields when not provided', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce(singleReturnResponse);

      await callTool(server, 'refund_order_return', { return_id: 9900001 });

      expect(client.post).toHaveBeenCalledWith(
        '/order_returns/9900001/refund.json',
        expect.objectContaining({}),
      );
    });
  });
});
