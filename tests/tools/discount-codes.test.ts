/**
 * Tests for registerDiscountCodeTools
 * Tools: list_discount_codes, create_discount_code
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import { registerDiscountCodeTools } from '../../src/tools/discount-codes.js';
import listFixture from '../fixtures/sapo/discount-codes/list-response.json' with { type: 'json' };

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

const singleFixture = { discount_code: listFixture.discount_codes[0] };

describe('registerDiscountCodeTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerDiscountCodeTools(server, client);
  });

  it('registers both tools', () => {
    const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
      ._registeredTools;
    expect(Object.keys(tools)).toHaveLength(2);
    expect(Object.keys(tools)).toContain('list_discount_codes');
    expect(Object.keys(tools)).toContain('create_discount_code');
  });

  describe('list_discount_codes', () => {
    it('calls nested endpoint /price_rules/{id}/discount_codes.json', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_discount_codes', { price_rule_id: 2168108 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith(
        '/price_rules/2168108/discount_codes.json',
        expect.objectContaining({ params: expect.objectContaining({ limit: 50 }) }),
      );
      expect(text.data).toHaveLength(1);
      expect(text.data[0].code).toBe('TESTPROBE_DELETE');
    });

    it('returns has_more pagination envelope', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_discount_codes', { price_rule_id: 2168108 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text).toHaveProperty('has_more', false);
      expect(text).toHaveProperty('next_since_id', null);
    });

    it('passes since_id cursor to API', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ discount_codes: [] });

      await callTool(server, 'list_discount_codes', {
        price_rule_id: 2168108,
        since_id: 1000000,
      });
      expect(client.get).toHaveBeenCalledWith(
        '/price_rules/2168108/discount_codes.json',
        expect.objectContaining({
          params: expect.objectContaining({ since_id: 1000000 }),
        }),
      );
    });

    it('returns isError when price_rule not found', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('not found', 404));

      const result = await callTool(server, 'list_discount_codes', { price_rule_id: 999 });
      expect(result).toHaveProperty('isError', true);
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ broken: true });

      const result = await callTool(server, 'list_discount_codes', { price_rule_id: 1 });
      expect(result).toHaveProperty('isError', true);
    });
  });

  describe('create_discount_code', () => {
    it('POSTs to nested /price_rules/{id}/discount_codes.json', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce(singleFixture);

      const result = await callTool(server, 'create_discount_code', {
        price_rule_id: 2168108,
        code: 'SUMMER10',
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.post).toHaveBeenCalledWith('/price_rules/2168108/discount_codes.json', {
        discount_code: { code: 'SUMMER10' },
      });
      expect(text.id).toBe(3315351);
    });

    it('returns isError when price_rule not found', async () => {
      vi.spyOn(client, 'post').mockRejectedValueOnce(new SapoNotFoundError('not found', 404));

      const result = await callTool(server, 'create_discount_code', {
        price_rule_id: 999,
        code: 'INVALID',
      });
      expect(result).toHaveProperty('isError', true);
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ broken: true });

      const result = await callTool(server, 'create_discount_code', {
        price_rule_id: 1,
        code: 'TEST',
      });
      expect(result).toHaveProperty('isError', true);
    });
  });
});
