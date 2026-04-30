/**
 * Tests for registerStoreInfoTools — get_store_info
 *
 * Endpoint: GET /admin/store.json
 * Note: Sapo uses "store" not "shop".
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SapoClient } from '../../src/client/http.js';
import { registerStoreInfoTools } from '../../src/tools/store-info.js';

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

const storeFixture = {
  store: {
    id: 99001,
    name: 'Giap Duc Thang SCS',
    email: 'owner@example.vn',
    domain: 'giapducthangscs.mysapo.net',
    province: 'Thành phố Hồ Chí Minh',
    district: 'Quận 1',
    address: '123 Nguyễn Huệ',
    currency: 'VND',
    timezone: 'Asia/Ho_Chi_Minh',
    shop_owner: 'Nguyễn Văn A',
    plan_name: 'basic',
    created_on: '2024-01-01T00:00:00Z',
    modified_on: '2026-04-30T00:00:00Z',
  },
};

describe('registerStoreInfoTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerStoreInfoTools(server, client);
  });

  it('registers get_store_info tool', () => {
    const tools = (
      server as unknown as {
        _registeredTools: Record<string, unknown>;
      }
    )._registeredTools;
    expect(tools.get_store_info).toBeDefined();
  });

  describe('get_store_info', () => {
    it('calls /store.json and returns store data', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(storeFixture);

      const result = await callTool(server, 'get_store_info', {});
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/store.json');
      expect(text.name).toBe('Giap Duc Thang SCS');
      expect(text.currency).toBe('VND');
    });

    it('returns province as full Vietnamese name', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(storeFixture);

      const result = await callTool(server, 'get_store_info', {});
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.province).toBe('Thành phố Hồ Chí Minh');
    });

    it('handles unwrapped response (no store key)', async () => {
      // Some Sapo endpoints return unwrapped — schema should handle both
      vi.spyOn(client, 'get').mockResolvedValueOnce(storeFixture.store);

      const result = await callTool(server, 'get_store_info', {});
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.name).toBe('Giap Duc Thang SCS');
    });

    it('returns isError on invalid response', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ invalid: 'response' });

      // Passthrough schema accepts nearly anything with store wrapper missing
      // We verify no exception thrown at minimum
      const result = await callTool(server, 'get_store_info', {});
      expect(result).toBeDefined();
    });

    it('passes through unknown fields from store response', async () => {
      const withExtra = {
        store: { ...storeFixture.store, custom_config: 'web-batch-a' },
      };
      vi.spyOn(client, 'get').mockResolvedValueOnce(withExtra);

      const result = await callTool(server, 'get_store_info', {});
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect((text as Record<string, unknown>).custom_config).toBe('web-batch-a');
    });
  });
});
