/**
 * Tests for registerOrdersCounterTools — list_pos_orders, get_pos_order
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import { registerOrdersCounterTools } from '../../src/tools/orders-counter.js';
import ordersListFixture from '../fixtures/sapo/orders/list-response.json' with { type: 'json' };
import orderSingleFixture from '../fixtures/sapo/orders/single.json' with { type: 'json' };

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

describe('registerOrdersCounterTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerOrdersCounterTools(server, client);
  });

  it('registers list_pos_orders and get_pos_order', () => {
    const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
      ._registeredTools;
    expect(Object.keys(tools)).toContain('list_pos_orders');
    expect(Object.keys(tools)).toContain('get_pos_order');
  });

  describe('list_pos_orders', () => {
    it('always passes source_name=pos to /orders.json', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(ordersListFixture);

      await callTool(server, 'list_pos_orders', {});

      expect(client.get).toHaveBeenCalledWith(
        '/orders.json',
        expect.objectContaining({
          params: expect.objectContaining({ source_name: 'pos' }),
        }),
      );
    });

    it('returns paginated envelope', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(ordersListFixture);

      const result = await callTool(server, 'list_pos_orders', { limit: 50 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text).toHaveProperty('data');
      expect(text).toHaveProperty('has_more');
      expect(text).toHaveProperty('next_since_id');
    });

    it('passes optional filters along with source_name=pos', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(ordersListFixture);

      await callTool(server, 'list_pos_orders', {
        status: 'closed',
        financial_status: 'paid',
        since_id: 1000,
      });

      expect(client.get).toHaveBeenCalledWith(
        '/orders.json',
        expect.objectContaining({
          params: expect.objectContaining({
            source_name: 'pos',
            status: 'closed',
            financial_status: 'paid',
            since_id: 1000,
          }),
        }),
      );
    });
  });

  describe('get_pos_order', () => {
    it('calls /orders/{id}.json and returns order', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(orderSingleFixture);

      const result = await callTool(server, 'get_pos_order', { order_id: 5001 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/orders/5001.json');
      expect(text).toHaveProperty('id');
    });

    it('returns isError on SapoNotFoundError', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('Order'));

      const result = await callTool(server, 'get_pos_order', { order_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });
});
