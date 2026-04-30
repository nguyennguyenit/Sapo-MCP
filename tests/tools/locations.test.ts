/**
 * Tests for registerLocationTools — list_locations, get_location
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import { registerLocationTools } from '../../src/tools/locations.js';
import listFixture from '../fixtures/sapo/locations/list.json' with { type: 'json' };
import singleFixture from '../fixtures/sapo/locations/single.json' with { type: 'json' };

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

describe('registerLocationTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerLocationTools(server, client);
  });

  it('registers list_locations and get_location', () => {
    const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
      ._registeredTools;
    expect(Object.keys(tools)).toContain('list_locations');
    expect(Object.keys(tools)).toContain('get_location');
  });

  describe('list_locations', () => {
    it('calls /locations.json and returns locations array', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_locations', {});
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/locations.json', expect.any(Object));
      expect(Array.isArray(text)).toBe(true);
      expect(text).toHaveLength(2);
      expect(text[0].id).toBe(10001);
    });

    it('passes limit param when provided', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      await callTool(server, 'list_locations', { limit: 5 });
      expect(client.get).toHaveBeenCalledWith(
        '/locations.json',
        expect.objectContaining({ params: expect.objectContaining({ limit: 5 }) }),
      );
    });

    it('returns isError on invalid response shape', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ wrong_key: [] });

      const result = await callTool(server, 'list_locations', {});
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  describe('get_location', () => {
    it('calls /locations/{id}.json and returns location data', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(singleFixture);

      const result = await callTool(server, 'get_location', { location_id: 10001 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/locations/10001.json');
      expect(text.id).toBe(10001);
      expect(text.name).toBe('Chi nhánh Hà Nội');
    });

    it('returns isError on SapoNotFoundError', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('Location'));

      const result = await callTool(server, 'get_location', { location_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });
});
