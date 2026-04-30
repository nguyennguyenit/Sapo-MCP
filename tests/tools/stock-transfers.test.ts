/**
 * Tests for registerStockTransferTools — list_stock_transfers, get_stock_transfer
 * Fixtures: stub (replace with real capture from `npm run capture:fixtures` before 0.2.0 publish)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import { registerStockTransferTools } from '../../src/tools/stock-transfers.js';
import listFixture from '../fixtures/sapo/stock-transfers/list.json' with { type: 'json' };
import singleFixture from '../fixtures/sapo/stock-transfers/single.json' with { type: 'json' };

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

describe('registerStockTransferTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerStockTransferTools(server, client);
  });

  it('registers list_stock_transfers and get_stock_transfer', () => {
    const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
      ._registeredTools;
    expect(Object.keys(tools)).toContain('list_stock_transfers');
    expect(Object.keys(tools)).toContain('get_stock_transfer');
  });

  describe('list_stock_transfers', () => {
    it('calls /stock_transfers.json and returns paginated envelope', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_stock_transfers', { limit: 2 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith(
        '/stock_transfers.json',
        expect.objectContaining({ params: expect.objectContaining({ limit: 2 }) }),
      );
      expect(text.data).toHaveLength(2);
      expect(text.has_more).toBe(true);
    });

    it('returns has_more=false when items < limit', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_stock_transfers', { limit: 50 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.has_more).toBe(false);
      expect(text.next_since_id).toBeNull();
    });

    it('passes status filter when provided', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ stock_transfers: [] });

      await callTool(server, 'list_stock_transfers', { status: 'pending' });
      expect(client.get).toHaveBeenCalledWith(
        '/stock_transfers.json',
        expect.objectContaining({ params: expect.objectContaining({ status: 'pending' }) }),
      );
    });
  });

  describe('get_stock_transfer', () => {
    it('calls /stock_transfers/{id}.json and returns transfer data', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(singleFixture);

      const result = await callTool(server, 'get_stock_transfer', { transfer_id: 50001 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/stock_transfers/50001.json');
      expect(text.id).toBe(50001);
      expect(text.status).toBe('completed');
    });

    it('returns isError on SapoNotFoundError', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('StockTransfer'));

      const result = await callTool(server, 'get_stock_transfer', { transfer_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });
});
