/**
 * Tests for registerPriceRuleTools
 * Tools: list_price_rules, get_price_rule, create_price_rule, update_price_rule
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import { registerPriceRuleTools } from '../../src/tools/price-rules.js';
import listFixture from '../fixtures/sapo/price-rules/list-response.json' with { type: 'json' };
import singleFixture from '../fixtures/sapo/price-rules/single.json' with { type: 'json' };

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

describe('registerPriceRuleTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerPriceRuleTools(server, client);
  });

  it('registers all 4 tools', () => {
    const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
      ._registeredTools;
    expect(Object.keys(tools)).toHaveLength(4);
    expect(Object.keys(tools)).toContain('list_price_rules');
    expect(Object.keys(tools)).toContain('get_price_rule');
    expect(Object.keys(tools)).toContain('create_price_rule');
    expect(Object.keys(tools)).toContain('update_price_rule');
  });

  describe('list_price_rules', () => {
    it('calls /price_rules.json and returns paginated envelope', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_price_rules', { limit: 50 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith(
        '/price_rules.json',
        expect.objectContaining({ params: expect.objectContaining({ limit: 50 }) }),
      );
      expect(text.data).toHaveLength(1);
      expect(text.has_more).toBe(false);
      expect(text.next_since_id).toBeNull();
    });

    it('passes status filter to API', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ price_rules: [] });

      await callTool(server, 'list_price_rules', { status: 'active' });
      expect(client.get).toHaveBeenCalledWith(
        '/price_rules.json',
        expect.objectContaining({ params: expect.objectContaining({ status: 'active' }) }),
      );
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ bad: 'response' });

      const result = await callTool(server, 'list_price_rules', {});
      expect(result).toHaveProperty('isError', true);
    });
  });

  describe('get_price_rule', () => {
    it('calls /price_rules/{id}.json and returns price rule with string value', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(singleFixture);

      const result = await callTool(server, 'get_price_rule', { price_rule_id: 2168108 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/price_rules/2168108.json');
      expect(text.id).toBe(2168108);
      expect(text.value).toBe('-10.0');
      expect(typeof text.value).toBe('string');
    });

    it('returns isError on not found', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('not found', 404));

      const result = await callTool(server, 'get_price_rule', { price_rule_id: 999 });
      expect(result).toHaveProperty('isError', true);
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ broken: true });

      const result = await callTool(server, 'get_price_rule', { price_rule_id: 1 });
      expect(result).toHaveProperty('isError', true);
    });
  });

  describe('create_price_rule', () => {
    it('POSTs to /price_rules.json with required fields', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce(singleFixture);

      const result = await callTool(server, 'create_price_rule', {
        title: 'Summer Sale',
        value_type: 'percentage',
        value: '-10.0',
        target_type: 'line_item',
        target_selection: 'all',
        allocation_method: 'across',
        customer_selection: 'all',
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.post).toHaveBeenCalledWith(
        '/price_rules.json',
        expect.objectContaining({
          price_rule: expect.objectContaining({
            title: 'Summer Sale',
            value: '-10.0',
            value_type: 'percentage',
          }),
        }),
      );
      expect(text.id).toBe(2168108);
    });

    it('includes optional usage_limit when provided', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce(singleFixture);

      await callTool(server, 'create_price_rule', {
        title: 'Limited',
        value_type: 'fixed_amount',
        value: '-50000',
        target_type: 'line_item',
        target_selection: 'all',
        allocation_method: 'each',
        customer_selection: 'all',
        usage_limit: 100,
      });

      expect(client.post).toHaveBeenCalledWith(
        '/price_rules.json',
        expect.objectContaining({
          price_rule: expect.objectContaining({ usage_limit: 100 }),
        }),
      );
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ broken: true });

      const result = await callTool(server, 'create_price_rule', {
        title: 'T',
        value_type: 'percentage',
        value: '-5.0',
        target_type: 'line_item',
        target_selection: 'all',
        allocation_method: 'across',
        customer_selection: 'all',
      });
      expect(result).toHaveProperty('isError', true);
    });
  });

  describe('update_price_rule', () => {
    it('PUTs to /price_rules/{id}.json with partial fields', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce(singleFixture);

      const result = await callTool(server, 'update_price_rule', {
        price_rule_id: 2168108,
        title: 'New Title',
        value: '-15.0',
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.put).toHaveBeenCalledWith(
        '/price_rules/2168108.json',
        expect.objectContaining({
          price_rule: expect.objectContaining({ title: 'New Title', value: '-15.0' }),
        }),
      );
      expect(text.id).toBe(2168108);
    });

    it('returns isError on not found', async () => {
      vi.spyOn(client, 'put').mockRejectedValueOnce(new SapoNotFoundError('not found', 404));

      const result = await callTool(server, 'update_price_rule', {
        price_rule_id: 999,
        title: 'test',
      });
      expect(result).toHaveProperty('isError', true);
    });

    it('does not include price_rule_id in the PUT body', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce(singleFixture);

      await callTool(server, 'update_price_rule', { price_rule_id: 2168108, title: 'Test' });

      const putCall = vi.mocked(client.put).mock.calls[0];
      const body = putCall[1] as { price_rule: Record<string, unknown> };
      expect(body.price_rule).not.toHaveProperty('price_rule_id');
    });
  });
});
