/**
 * Tests for registerCustomerAddressTools — list_customer_addresses
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import { registerCustomerAddressTools } from '../../src/tools/customer-addresses.js';
import addressesFixture from '../fixtures/sapo/customers/addresses-list.json' with { type: 'json' };

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

describe('registerCustomerAddressTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerCustomerAddressTools(server, client);
  });

  describe('list_customer_addresses', () => {
    it('calls /customers/{id}/addresses.json', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(addressesFixture);

      await callTool(server, 'list_customer_addresses', { customer_id: 1001 });
      expect(client.get).toHaveBeenCalledWith('/customers/1001/addresses.json', expect.any(Object));
    });

    it('returns list of addresses with VN fields', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(addressesFixture);

      const result = await callTool(server, 'list_customer_addresses', { customer_id: 1001 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text).toHaveLength(2);
      expect(text[0].province).toBe('Hà Nội');
      expect(text[0].district).toBe('Hoàn Kiếm');
      expect(text[0].ward).toBe('Lý Thái Tổ');
    });

    it('returns isError:true when customer not found', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('Customer'));

      const result = await callTool(server, 'list_customer_addresses', { customer_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });

    it('passes limit param when provided', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(addressesFixture);

      await callTool(server, 'list_customer_addresses', { customer_id: 1001, limit: 10 });
      expect(client.get).toHaveBeenCalledWith(
        '/customers/1001/addresses.json',
        expect.objectContaining({ params: expect.objectContaining({ limit: 10 }) }),
      );
    });
  });
});
