/**
 * Tests for registerInventoryReadTools — get_inventory_levels
 *
 * Fixture: real captured from store giapducthangscs (2026-04-30).
 * 3 inventory levels, float quantities (100.000), timestamps as created_at/updated_at.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SapoClient } from '../../src/client/http.js';
import { registerInventoryReadTools } from '../../src/tools/inventory-readonly.js';
import listFixture from '../fixtures/sapo/inventory/list-response.json' with { type: 'json' };

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

describe('registerInventoryReadTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerInventoryReadTools(server, client);
  });

  describe('get_inventory_levels', () => {
    it('calls /inventory_levels.json and returns 3 real captured levels', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'get_inventory_levels', {});
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith(
        '/inventory_levels.json',
        expect.objectContaining({ params: {} }),
      );
      // Real fixture from store giapducthangscs: 3 inventory levels
      expect(text).toHaveLength(listFixture.inventory_levels.length);
      // Verify real IDs from captured fixture
      expect(text[0].inventory_item_id).toBe(listFixture.inventory_levels[0].inventory_item_id);
      expect(text[0].available).toBe(listFixture.inventory_levels[0].available);
    });

    it('passes location_id filter', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      await callTool(server, 'get_inventory_levels', { location_id: 825802 });
      expect(client.get).toHaveBeenCalledWith(
        '/inventory_levels.json',
        expect.objectContaining({
          params: expect.objectContaining({ location_id: 825802 }),
        }),
      );
    });

    it('passes inventory_item_id filter', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const realItemId = listFixture.inventory_levels[0].inventory_item_id;
      await callTool(server, 'get_inventory_levels', { inventory_item_id: realItemId });
      expect(client.get).toHaveBeenCalledWith(
        '/inventory_levels.json',
        expect.objectContaining({
          params: expect.objectContaining({ inventory_item_id: realItemId }),
        }),
      );
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ unexpected_key: [] });

      const result = await callTool(server, 'get_inventory_levels', {});
      expect((result as { isError: boolean }).isError).toBe(true);
    });

    it('passes page and limit params', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      await callTool(server, 'get_inventory_levels', { limit: 100, page: 2 });
      expect(client.get).toHaveBeenCalledWith(
        '/inventory_levels.json',
        expect.objectContaining({
          params: expect.objectContaining({ limit: 100, page: 2 }),
        }),
      );
    });
  });
});
