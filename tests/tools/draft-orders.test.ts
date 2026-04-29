/**
 * Tests for registerDraftOrderTools
 * Tools: list_draft_orders, get_draft_order, create_draft_order,
 *        update_draft_order, complete_draft_order, send_draft_order_invoice
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import { registerDraftOrderTools } from '../../src/tools/draft-orders.js';
import singleFixture from '../fixtures/sapo/draft-orders/single.json' with { type: 'json' };

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

const listFixture = { draft_orders: [singleFixture.draft_order] };

describe('registerDraftOrderTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerDraftOrderTools(server, client);
  });

  it('registers all 6 tools', () => {
    const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
      ._registeredTools;
    expect(Object.keys(tools)).toHaveLength(6);
    expect(Object.keys(tools)).toContain('list_draft_orders');
    expect(Object.keys(tools)).toContain('get_draft_order');
    expect(Object.keys(tools)).toContain('create_draft_order');
    expect(Object.keys(tools)).toContain('update_draft_order');
    expect(Object.keys(tools)).toContain('complete_draft_order');
    expect(Object.keys(tools)).toContain('send_draft_order_invoice');
  });

  describe('list_draft_orders', () => {
    it('calls /draft_orders.json and returns paginated envelope', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_draft_orders', { limit: 50 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith(
        '/draft_orders.json',
        expect.objectContaining({ params: expect.objectContaining({ limit: 50 }) }),
      );
      expect(text.data).toHaveLength(1);
      expect(text).toHaveProperty('has_more', false);
      expect(text).toHaveProperty('next_since_id', null);
    });

    it('passes status filter to API', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ draft_orders: [] });

      await callTool(server, 'list_draft_orders', { status: 'open' });
      expect(client.get).toHaveBeenCalledWith(
        '/draft_orders.json',
        expect.objectContaining({ params: expect.objectContaining({ status: 'open' }) }),
      );
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ bad: 'response' });

      const result = await callTool(server, 'list_draft_orders', {});
      expect(result).toHaveProperty('isError', true);
    });
  });

  describe('get_draft_order', () => {
    it('calls /draft_orders/{id}.json and returns draft order', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(singleFixture);

      const result = await callTool(server, 'get_draft_order', { draft_order_id: 6586400 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/draft_orders/6586400.json');
      expect(text.id).toBe(6586400);
    });

    it('returns isError on not found', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('not found', 404));

      const result = await callTool(server, 'get_draft_order', { draft_order_id: 999 });
      expect(result).toHaveProperty('isError', true);
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ bad: 'schema' });

      const result = await callTool(server, 'get_draft_order', { draft_order_id: 6586400 });
      expect(result).toHaveProperty('isError', true);
    });
  });

  describe('create_draft_order', () => {
    it('POSTs to /draft_orders.json with draft_order body', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce(singleFixture);

      const result = await callTool(server, 'create_draft_order', {
        line_items: [{ variant_id: 147237422, quantity: 1 }],
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.post).toHaveBeenCalledWith(
        '/draft_orders.json',
        expect.objectContaining({
          draft_order: expect.objectContaining({
            line_items: [{ variant_id: 147237422, quantity: 1 }],
          }),
        }),
      );
      expect(text.id).toBe(6586400);
    });

    it('includes customer id as nested customer object when customer_id provided', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce(singleFixture);

      await callTool(server, 'create_draft_order', {
        line_items: [{ variant_id: 100, quantity: 1 }],
        customer_id: 999,
      });

      expect(client.post).toHaveBeenCalledWith(
        '/draft_orders.json',
        expect.objectContaining({
          draft_order: expect.objectContaining({ customer: { id: 999 } }),
        }),
      );
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ broken: true });

      const result = await callTool(server, 'create_draft_order', {
        line_items: [{ variant_id: 1, quantity: 1 }],
      });
      expect(result).toHaveProperty('isError', true);
    });
  });

  describe('update_draft_order', () => {
    it('PUTs to /draft_orders/{id}.json', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce(singleFixture);

      const result = await callTool(server, 'update_draft_order', {
        draft_order_id: 6586400,
        note: 'Updated note',
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.put).toHaveBeenCalledWith(
        '/draft_orders/6586400.json',
        expect.objectContaining({ draft_order: expect.objectContaining({ note: 'Updated note' }) }),
      );
      expect(text.id).toBe(6586400);
    });

    it('returns isError on not found', async () => {
      vi.spyOn(client, 'put').mockRejectedValueOnce(new SapoNotFoundError('not found', 404));

      const result = await callTool(server, 'update_draft_order', {
        draft_order_id: 999,
        note: 'test',
      });
      expect(result).toHaveProperty('isError', true);
    });
  });

  describe('complete_draft_order', () => {
    it('PUTs to /draft_orders/{id}/complete.json', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce(singleFixture);

      await callTool(server, 'complete_draft_order', { draft_order_id: 6586400 });

      expect(client.put).toHaveBeenCalledWith(
        '/draft_orders/6586400/complete.json',
        {},
        expect.anything(),
      );
    });

    it('passes payment_pending param when provided', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce(singleFixture);

      await callTool(server, 'complete_draft_order', {
        draft_order_id: 6586400,
        payment_pending: true,
      });

      expect(client.put).toHaveBeenCalledWith(
        '/draft_orders/6586400/complete.json',
        {},
        expect.objectContaining({ params: expect.objectContaining({ payment_pending: true }) }),
      );
    });

    it('returns isError on not found', async () => {
      vi.spyOn(client, 'put').mockRejectedValueOnce(new SapoNotFoundError('not found', 404));

      const result = await callTool(server, 'complete_draft_order', { draft_order_id: 999 });
      expect(result).toHaveProperty('isError', true);
    });
  });

  describe('send_draft_order_invoice', () => {
    it('POSTs to /draft_orders/{id}/send_invoice.json', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ draft_order_invoice: {} });

      await callTool(server, 'send_draft_order_invoice', {
        draft_order_id: 6586400,
        to: 'customer@example.com',
        subject: 'Your invoice',
      });

      expect(client.post).toHaveBeenCalledWith(
        '/draft_orders/6586400/send_invoice.json',
        expect.objectContaining({
          draft_order_invoice: expect.objectContaining({
            to: 'customer@example.com',
            subject: 'Your invoice',
          }),
        }),
      );
    });

    it('returns isError on not found', async () => {
      vi.spyOn(client, 'post').mockRejectedValueOnce(new SapoNotFoundError('not found', 404));

      const result = await callTool(server, 'send_draft_order_invoice', { draft_order_id: 999 });
      expect(result).toHaveProperty('isError', true);
    });
  });
});
