/**
 * Tests for registerRefundTools — list_refunds, get_refund, create_refund
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import type { GuardContext } from '../../src/guards.js';
import { registerRefundTools } from '../../src/tools/refunds.js';
import listFixture from '../fixtures/sapo/refunds/list.json' with { type: 'json' };
import singleFixture from '../fixtures/sapo/refunds/single.json' with { type: 'json' };

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

const wildcardCtx: GuardContext = { allowOps: new Set(['*']) };
const emptyCtx: GuardContext = { allowOps: new Set() };

describe('registerRefundTools', () => {
  describe('registration', () => {
    it('registers list_refunds and get_refund regardless of allowOps', () => {
      const server = makeServer();
      const client = makeClient();
      registerRefundTools(server, client, emptyCtx);
      const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
        ._registeredTools;
      expect(Object.keys(tools)).toContain('list_refunds');
      expect(Object.keys(tools)).toContain('get_refund');
      expect(Object.keys(tools)).not.toContain('create_refund');
    });

    it('registers create_refund when allowOps includes refund', () => {
      const server = makeServer();
      const client = makeClient();
      registerRefundTools(server, client, { allowOps: new Set(['refund']) });
      const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
        ._registeredTools;
      expect(Object.keys(tools)).toContain('create_refund');
    });

    it('registers create_refund with wildcard', () => {
      const server = makeServer();
      const client = makeClient();
      registerRefundTools(server, client, wildcardCtx);
      const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
        ._registeredTools;
      expect(Object.keys(tools)).toContain('create_refund');
    });
  });

  describe('list_refunds', () => {
    let server: McpServer;
    let client: SapoClient;

    beforeEach(() => {
      server = makeServer();
      client = makeClient();
      registerRefundTools(server, client, wildcardCtx);
    });

    it('calls /orders/{id}/refunds.json', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);
      const result = await callTool(server, 'list_refunds', { order_id: 174107276 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/orders/174107276/refunds.json');
      expect(Array.isArray(text.data)).toBe(true);
      expect(text.data.length).toBeGreaterThanOrEqual(1);
    });

    it('returns isError on not found', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('Order'));
      const result = await callTool(server, 'list_refunds', { order_id: 9999 });
      expect(result).toHaveProperty('isError', true);
    });
  });

  describe('get_refund', () => {
    let server: McpServer;
    let client: SapoClient;

    beforeEach(() => {
      server = makeServer();
      client = makeClient();
      registerRefundTools(server, client, wildcardCtx);
    });

    it('calls /orders/{order_id}/refunds/{refund_id}.json', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(singleFixture);
      const result = await callTool(server, 'get_refund', {
        order_id: 174107276,
        refund_id: 25412855,
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/orders/174107276/refunds/25412855.json');
      expect(text.id).toBe(25412855);
      expect(text.total_refunded).toBe(150000);
    });

    it('returns isError on not found', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('Refund'));
      const result = await callTool(server, 'get_refund', { order_id: 1, refund_id: 999 });
      expect(result).toHaveProperty('isError', true);
    });
  });

  describe('create_refund', () => {
    let server: McpServer;
    let client: SapoClient;

    beforeEach(() => {
      server = makeServer();
      client = makeClient();
      registerRefundTools(server, client, wildcardCtx);
    });

    it('POSTs to /orders/{id}/refunds.json with refund payload', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce(singleFixture);
      await callTool(server, 'create_refund', {
        confirm: true,
        order_id: 174107276,
        refund_line_items: [{ line_item_id: 290320676, quantity: 1 }],
      });

      expect(client.post).toHaveBeenCalledWith('/orders/174107276/refunds.json', {
        refund: {
          refund_line_items: [{ line_item_id: 290320676, quantity: 1 }],
        },
      });
    });

    it('forwards transactions and note when provided', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce(singleFixture);
      await callTool(server, 'create_refund', {
        confirm: true,
        order_id: 1,
        transactions: [
          { parent_id: 100, amount: 50, kind: 'refund', gateway: 'manual' },
        ],
        note: 'partial refund',
        notify: false,
      });

      expect(client.post).toHaveBeenCalledWith('/orders/1/refunds.json', {
        refund: {
          transactions: [{ parent_id: 100, amount: 50, kind: 'refund', gateway: 'manual' }],
          note: 'partial refund',
          notify: false,
        },
      });
    });

    it('returns isError on not found', async () => {
      vi.spyOn(client, 'post').mockRejectedValueOnce(new SapoNotFoundError('Order'));
      const result = await callTool(server, 'create_refund', {
        confirm: true,
        order_id: 999,
        transactions: [],
      });
      expect(result).toHaveProperty('isError', true);
    });
  });
});
