/**
 * Tests for registerFulfillmentTools:
 * list_fulfillments_for_order, get_fulfillment, create_fulfillment, update_fulfillment_tracking
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import { registerFulfillmentTools } from '../../src/tools/fulfillments.js';
import listFixture from '../fixtures/sapo/fulfillments/list-response.json' with { type: 'json' };

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

const singleFulfillmentResponse = {
  fulfillment: listFixture.fulfillments[0],
};

describe('registerFulfillmentTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerFulfillmentTools(server, client);
  });

  describe('list_fulfillments_for_order', () => {
    it('calls /orders/{id}/fulfillments.json and returns fulfillments array', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_fulfillments_for_order', {
        order_id: 174107276,
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/orders/174107276/fulfillments.json');
      expect(Array.isArray(text)).toBe(true);
      expect(text).toHaveLength(listFixture.fulfillments.length);
    });

    it('returns fulfillment with correct id and status', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_fulfillments_for_order', {
        order_id: 174107276,
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text[0].id).toBe(132712633);
      expect(text[0].status).toBe('success');
    });

    it('returns isError:true on SapoNotFoundError', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('Order'));

      const result = await callTool(server, 'list_fulfillments_for_order', { order_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ invalid: true });

      const result = await callTool(server, 'list_fulfillments_for_order', { order_id: 1 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  describe('get_fulfillment', () => {
    it('calls /fulfillments/{id}.json and returns fulfillment', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(singleFulfillmentResponse);

      const result = await callTool(server, 'get_fulfillment', { fulfillment_id: 132712633 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/fulfillments/132712633.json');
      expect(text.id).toBe(132712633);
      expect(text.tracking_company).toBe('Anh Phương');
    });

    it('returns isError:true on SapoNotFoundError', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('Fulfillment'));

      const result = await callTool(server, 'get_fulfillment', { fulfillment_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  describe('create_fulfillment', () => {
    it('POSTs to /orders/{id}/fulfillments.json with wrapped body', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce(singleFulfillmentResponse);

      await callTool(server, 'create_fulfillment', {
        order_id: 174107276,
        tracking_company: 'Giao Hàng Nhanh',
        tracking_number: 'GHN12345',
      });

      expect(client.post).toHaveBeenCalledWith(
        '/orders/174107276/fulfillments.json',
        expect.objectContaining({
          fulfillment: expect.objectContaining({
            tracking_company: 'Giao Hàng Nhanh',
            tracking_number: 'GHN12345',
          }),
        }),
      );
    });

    it('includes line_items in body when provided', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce(singleFulfillmentResponse);

      await callTool(server, 'create_fulfillment', {
        order_id: 174107276,
        line_items: [{ id: 290320676, quantity: 1 }],
      });

      expect(client.post).toHaveBeenCalledWith(
        '/orders/174107276/fulfillments.json',
        expect.objectContaining({
          fulfillment: expect.objectContaining({
            line_items: [{ id: 290320676, quantity: 1 }],
          }),
        }),
      );
    });

    it('returns the created fulfillment', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce(singleFulfillmentResponse);

      const result = await callTool(server, 'create_fulfillment', { order_id: 174107276 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.id).toBe(132712633);
      expect(text.status).toBe('success');
    });

    it('returns isError:true on SapoNotFoundError', async () => {
      vi.spyOn(client, 'post').mockRejectedValueOnce(new SapoNotFoundError('Order'));

      const result = await callTool(server, 'create_fulfillment', { order_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ invalid: true });

      const result = await callTool(server, 'create_fulfillment', { order_id: 1 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  describe('update_fulfillment_tracking', () => {
    it('PUTs to /fulfillments/{id}.json with tracking fields', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce(singleFulfillmentResponse);

      await callTool(server, 'update_fulfillment_tracking', {
        fulfillment_id: 132712633,
        tracking_company: 'GHTK',
        tracking_number: 'GHTK999',
        tracking_url: 'https://ghtk.vn/track/GHTK999',
      });

      expect(client.put).toHaveBeenCalledWith(
        '/fulfillments/132712633.json',
        expect.objectContaining({
          fulfillment: expect.objectContaining({
            tracking_company: 'GHTK',
            tracking_number: 'GHTK999',
            tracking_url: 'https://ghtk.vn/track/GHTK999',
          }),
        }),
      );
    });

    it('returns the updated fulfillment', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce(singleFulfillmentResponse);

      const result = await callTool(server, 'update_fulfillment_tracking', {
        fulfillment_id: 132712633,
        tracking_number: 'NEW123',
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.id).toBe(132712633);
    });

    it('returns isError:true on SapoNotFoundError', async () => {
      vi.spyOn(client, 'put').mockRejectedValueOnce(new SapoNotFoundError('Fulfillment'));

      const result = await callTool(server, 'update_fulfillment_tracking', {
        fulfillment_id: 9999,
      });
      expect((result as { isError: boolean }).isError).toBe(true);
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce({ invalid: true });

      const result = await callTool(server, 'update_fulfillment_tracking', {
        fulfillment_id: 1,
      });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });
});
