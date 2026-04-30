/**
 * Tests for registerPosShiftTools — list_pos_shifts, get_pos_shift
 * Fixtures: stub (replace with real capture from `npm run capture:fixtures` before 0.2.0 publish)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import { registerPosShiftTools } from '../../src/tools/pos-shifts.js';
import listFixture from '../fixtures/sapo/pos-shifts/list.json' with { type: 'json' };
import singleFixture from '../fixtures/sapo/pos-shifts/single.json' with { type: 'json' };

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

describe('registerPosShiftTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerPosShiftTools(server, client);
  });

  it('registers list_pos_shifts and get_pos_shift', () => {
    const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
      ._registeredTools;
    expect(Object.keys(tools)).toContain('list_pos_shifts');
    expect(Object.keys(tools)).toContain('get_pos_shift');
  });

  describe('list_pos_shifts', () => {
    it('calls /pos_shifts.json and returns paginated envelope', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_pos_shifts', { limit: 2 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith(
        '/pos_shifts.json',
        expect.objectContaining({ params: expect.objectContaining({ limit: 2 }) }),
      );
      expect(text.data).toHaveLength(2);
      expect(text.has_more).toBe(true);
    });

    it('returns has_more=false when items < limit', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_pos_shifts', { limit: 50 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.has_more).toBe(false);
      expect(text.next_since_id).toBeNull();
    });

    it('passes location_id filter when provided', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ pos_shifts: [] });

      await callTool(server, 'list_pos_shifts', { location_id: 10001 });
      expect(client.get).toHaveBeenCalledWith(
        '/pos_shifts.json',
        expect.objectContaining({ params: expect.objectContaining({ location_id: 10001 }) }),
      );
    });
  });

  describe('get_pos_shift', () => {
    it('calls /pos_shifts/{id}.json and returns shift data', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(singleFixture);

      const result = await callTool(server, 'get_pos_shift', { shift_id: 40001 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/pos_shifts/40001.json');
      expect(text.id).toBe(40001);
      expect(text.status).toBe('closed');
    });

    it('returns isError on SapoNotFoundError', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('PosShift'));

      const result = await callTool(server, 'get_pos_shift', { shift_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });
});
