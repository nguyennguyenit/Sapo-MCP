/**
 * Tests for registerSupplierTools — list_suppliers, get_supplier
 * Fixtures: stub (replace with real capture from `npm run capture:fixtures` before 0.2.0 publish)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import { registerSupplierTools } from '../../src/tools/suppliers.js';
import listFixture from '../fixtures/sapo/suppliers/list.json' with { type: 'json' };
import singleFixture from '../fixtures/sapo/suppliers/single.json' with { type: 'json' };

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

describe('registerSupplierTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerSupplierTools(server, client);
  });

  it('registers list_suppliers and get_supplier', () => {
    const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
      ._registeredTools;
    expect(Object.keys(tools)).toContain('list_suppliers');
    expect(Object.keys(tools)).toContain('get_supplier');
  });

  describe('list_suppliers', () => {
    it('calls /suppliers.json and returns paginated envelope', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_suppliers', { limit: 2 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith(
        '/suppliers.json',
        expect.objectContaining({ params: expect.objectContaining({ limit: 2 }) }),
      );
      expect(text.data).toHaveLength(2);
      expect(text.has_more).toBe(true);
    });

    it('returns has_more=false when items < limit', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_suppliers', { limit: 50 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.has_more).toBe(false);
      expect(text.next_since_id).toBeNull();
    });

    it('passes since_id param when provided', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ suppliers: [] });

      await callTool(server, 'list_suppliers', { since_id: 30000 });
      expect(client.get).toHaveBeenCalledWith(
        '/suppliers.json',
        expect.objectContaining({ params: expect.objectContaining({ since_id: 30000 }) }),
      );
    });
  });

  describe('get_supplier', () => {
    it('calls /suppliers/{id}.json and returns supplier data', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(singleFixture);

      const result = await callTool(server, 'get_supplier', { supplier_id: 30001 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/suppliers/30001.json');
      expect(text.id).toBe(30001);
      expect(text.name).toBe('Công ty TNHH ABC');
    });

    it('returns isError on SapoNotFoundError', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('Supplier'));

      const result = await callTool(server, 'get_supplier', { supplier_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });
});
