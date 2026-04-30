/**
 * Tests for registerPaymentMethodTools — list_payment_methods
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SapoClient } from '../../src/client/http.js';
import { registerPaymentMethodTools } from '../../src/tools/payment-methods.js';
import listFixture from '../fixtures/sapo/payment-methods/list.json' with { type: 'json' };

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

describe('registerPaymentMethodTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerPaymentMethodTools(server, client);
  });

  it('registers list_payment_methods', () => {
    const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
      ._registeredTools;
    expect(Object.keys(tools)).toContain('list_payment_methods');
  });

  describe('list_payment_methods', () => {
    it('calls /payment_methods.json and returns payment methods array', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_payment_methods', {});
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/payment_methods.json');
      expect(Array.isArray(text)).toBe(true);
      expect(text).toHaveLength(3);
      expect(text[0].id).toBe(20001);
      expect(text[0].name).toBe('Tiền mặt');
    });

    it('returns isError on invalid response shape', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ wrong_key: [] });

      const result = await callTool(server, 'list_payment_methods', {});
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });
});
