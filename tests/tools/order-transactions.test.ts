/**
 * Tests for registerOrderTransactionTools — list_order_transactions, create_order_transaction
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import { registerOrderTransactionTools } from '../../src/tools/order-transactions.js';
import listFixture from '../fixtures/sapo/transactions/list-response.json' with { type: 'json' };

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

const singleTransactionResponse = {
  transaction: listFixture.transactions[0],
};

describe('registerOrderTransactionTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerOrderTransactionTools(server, client);
  });

  describe('list_order_transactions', () => {
    it('calls /orders/{id}/transactions.json and returns transactions array', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_order_transactions', {
        order_id: 174107276,
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/orders/174107276/transactions.json');
      expect(Array.isArray(text)).toBe(true);
      expect(text).toHaveLength(listFixture.transactions.length);
    });

    it('returns transaction with correct id and kind', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_order_transactions', {
        order_id: 174107276,
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text[0].id).toBe(148295019);
      expect(text[0].kind).toBe('sale');
    });

    it('returns isError:true on SapoNotFoundError', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('Order'));

      const result = await callTool(server, 'list_order_transactions', { order_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ invalid: true });

      const result = await callTool(server, 'list_order_transactions', { order_id: 1 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  describe('create_order_transaction', () => {
    it('POSTs to /orders/{id}/transactions.json with wrapped body', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce(singleTransactionResponse);

      await callTool(server, 'create_order_transaction', {
        order_id: 174107276,
        kind: 'sale',
        amount: 150000,
      });

      expect(client.post).toHaveBeenCalledWith(
        '/orders/174107276/transactions.json',
        expect.objectContaining({
          transaction: expect.objectContaining({ kind: 'sale', amount: 150000 }),
        }),
      );
    });

    it('includes optional fields in body when provided', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce(singleTransactionResponse);

      await callTool(server, 'create_order_transaction', {
        order_id: 174107276,
        kind: 'capture',
        amount: 150000,
        currency: 'VND',
        gateway: 'cod',
        parent_id: 148295019,
      });

      expect(client.post).toHaveBeenCalledWith(
        '/orders/174107276/transactions.json',
        expect.objectContaining({
          transaction: expect.objectContaining({
            kind: 'capture',
            currency: 'VND',
            gateway: 'cod',
            parent_id: 148295019,
          }),
        }),
      );
    });

    it('returns the created transaction', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce(singleTransactionResponse);

      const result = await callTool(server, 'create_order_transaction', {
        order_id: 174107276,
        kind: 'sale',
        amount: 150000,
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.id).toBe(148295019);
      expect(text.kind).toBe('sale');
    });

    it('returns isError:true on SapoNotFoundError', async () => {
      vi.spyOn(client, 'post').mockRejectedValueOnce(new SapoNotFoundError('Order'));

      const result = await callTool(server, 'create_order_transaction', {
        order_id: 9999,
        kind: 'sale',
        amount: 1000,
      });
      expect((result as { isError: boolean }).isError).toBe(true);
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ invalid: true });

      const result = await callTool(server, 'create_order_transaction', {
        order_id: 1,
        kind: 'sale',
        amount: 1000,
      });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });
});
