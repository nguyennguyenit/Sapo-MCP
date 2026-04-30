/**
 * Tests for registerAdministrativeUnitTools — list_provinces, list_districts, list_wards.
 * Covers Vietnam's 2025 reform discriminator: level=3 (63 tỉnh, 3-tier, default) vs level=2 (34 tỉnh, 2-tier).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SapoClient } from '../../src/client/http.js';
import { registerAdministrativeUnitTools } from '../../src/tools/administrative-units.js';

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

function parseOk(result: unknown): unknown {
  const r = result as { content: Array<{ text: string }>; isError?: boolean };
  if (r.isError) throw new Error(`tool returned isError: ${r.content[0].text}`);
  return JSON.parse(r.content[0].text);
}

describe('registerAdministrativeUnitTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerAdministrativeUnitTools(server, client);
  });

  describe('list_provinces', () => {
    it('omits level param when not provided (Sapo defaults to level=3 = 63-tỉnh 3-tier)', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({
        provinces: [{ id: 1, name: 'Hà Nội', code: '1', country_id: 201 }],
      });
      await callTool(server, 'list_provinces', {});
      expect(client.get).toHaveBeenCalledWith('/provinces.json', { params: {} });
    });

    it('passes level=2 to unlock 34-tỉnh schema', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({
        provinces: [{ id: 2001, name: 'Hà Nội', code: '2001', country_id: 201 }],
      });
      const result = await callTool(server, 'list_provinces', { level: 2 });
      expect(client.get).toHaveBeenCalledWith(
        '/provinces.json',
        expect.objectContaining({ params: { level: 2 } }),
      );
      const provinces = parseOk(result) as Array<{ code: string }>;
      expect(provinces[0].code).toBe('2001');
    });
  });

  describe('list_districts', () => {
    it('passes province_code and forwards level', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({
        districts: [{ id: 30, name: 'Quận 1', code: '30', province_id: 2 }],
      });
      await callTool(server, 'list_districts', { province_code: '2', level: 3 });
      expect(client.get).toHaveBeenCalledWith('/districts.json', {
        params: { province_code: '2', level: 3 },
      });
    });

    it('returns empty list for level=2 (Sapo bỏ cấp huyện sau cải cách)', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ districts: [] });
      const result = await callTool(server, 'list_districts', {
        province_code: '2001',
        level: 2,
      });
      expect(parseOk(result)).toEqual([]);
    });
  });

  describe('list_wards', () => {
    it('passes district_code for level=3 (3-tier) schema', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({
        wards: [
          {
            id: 9217,
            name: 'Phường Tân Định',
            code: '9217',
            province_id: 2,
            district_id: 30,
            district_code: '30',
          },
        ],
      });
      await callTool(server, 'list_wards', { district_code: '30', level: 3 });
      expect(client.get).toHaveBeenCalledWith('/wards.json', {
        params: { district_code: '30', level: 3 },
      });
    });

    it('parses level=2 wards with sentinel district_code "-1"', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({
        wards: [
          {
            id: 200001,
            name: 'Phường Hoàn Kiếm',
            code: '200001',
            province_id: 2001,
            district_id: -1,
            district_code: '-1',
          },
        ],
      });
      const result = await callTool(server, 'list_wards', {
        province_code: '2001',
        level: 2,
      });
      const wards = parseOk(result) as Array<{ district_code: string }>;
      expect(wards[0].district_code).toBe('-1');
    });
  });

  it('returns isError when Sapo response shape is unexpected', async () => {
    vi.spyOn(client, 'get').mockResolvedValueOnce({ unexpected: true });
    const result = (await callTool(server, 'list_provinces', {})) as { isError?: boolean };
    expect(result.isError).toBe(true);
  });
});
