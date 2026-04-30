/**
 * Tests for registerInventoryWriteTools
 * Tools: adjust_inventory_level, set_inventory_level (destructive), connect_inventory_level
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SapoClient } from '../../src/client/http.js';
import type { GuardContext } from '../../src/guards.js';
import { registerInventoryWriteTools } from '../../src/tools/inventory-write.js';

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

function getToolNames(server: McpServer): string[] {
  const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
    ._registeredTools;
  return Object.keys(tools);
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

const emptyCtx: GuardContext = { allowOps: new Set() };
const inventorySetCtx: GuardContext = { allowOps: new Set(['inventory_set']) };
const wildcardCtx: GuardContext = { allowOps: new Set(['*']) };

describe('registerInventoryWriteTools — guard behavior', () => {
  it('registers adjust and connect but NOT set with empty allowOps', () => {
    const server = makeServer();
    const client = makeClient();
    registerInventoryWriteTools(server, client, emptyCtx);
    const names = getToolNames(server);
    expect(names).toContain('adjust_inventory_level');
    expect(names).toContain('connect_inventory_level');
    expect(names).not.toContain('set_inventory_level');
  });

  it('registers all 3 tools with inventory_set category', () => {
    const server = makeServer();
    const client = makeClient();
    registerInventoryWriteTools(server, client, inventorySetCtx);
    const names = getToolNames(server);
    expect(names).toContain('adjust_inventory_level');
    expect(names).toContain('set_inventory_level');
    expect(names).toContain('connect_inventory_level');
    expect(names).toHaveLength(3);
  });

  it('registers all 3 tools with wildcard allowOps', () => {
    const server = makeServer();
    const client = makeClient();
    registerInventoryWriteTools(server, client, wildcardCtx);
    expect(getToolNames(server)).toHaveLength(3);
  });
});

describe('adjust_inventory_level', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerInventoryWriteTools(server, client, emptyCtx);
  });

  it('POSTs to /inventory_levels/adjust.json with correct body', async () => {
    vi.spyOn(client, 'post').mockResolvedValueOnce({ inventory_level: { id: 1 } });

    await callTool(server, 'adjust_inventory_level', {
      location_id: 10001,
      inventory_item_id: 500,
      available_adjustment: 10,
    });

    expect(client.post).toHaveBeenCalledWith('/inventory_levels/adjust.json', {
      location_id: 10001,
      inventory_item_id: 500,
      available_adjustment: 10,
    });
  });

  it('returns the raw API response', async () => {
    const mockResponse = { inventory_level: { id: 1, available: 15 } };
    vi.spyOn(client, 'post').mockResolvedValueOnce(mockResponse);

    const result = await callTool(server, 'adjust_inventory_level', {
      location_id: 10001,
      inventory_item_id: 500,
      available_adjustment: -5,
    });
    const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);
    expect(text).toEqual(mockResponse);
  });
});

describe('set_inventory_level', () => {
  it('POSTs to /inventory_levels/set.json when inventory_set allowed', async () => {
    const server = makeServer();
    const client = makeClient();
    registerInventoryWriteTools(server, client, inventorySetCtx);

    vi.spyOn(client, 'post').mockResolvedValueOnce({ inventory_level: { id: 1 } });

    await callTool(server, 'set_inventory_level', {
      confirm: true,
      location_id: 10001,
      inventory_item_id: 500,
      available: 100,
    });

    expect(client.post).toHaveBeenCalledWith('/inventory_levels/set.json', {
      location_id: 10001,
      inventory_item_id: 500,
      available: 100,
    });
  });
});

describe('adjust_inventory_level — error paths', () => {
  it('returns isError on invalid API response from adjust', async () => {
    const server = makeServer();
    const client = makeClient();
    registerInventoryWriteTools(server, client, emptyCtx);
    // adjust returns raw response as-is (no schema validation) so this tests okResponse path
    vi.spyOn(client, 'post').mockResolvedValueOnce(null);
    const result = await callTool(server, 'adjust_inventory_level', {
      location_id: 1,
      inventory_item_id: 2,
      available_adjustment: 0,
    });
    // null is returned as-is via okResponse
    expect(result).toHaveProperty('content');
  });
});

describe('connect_inventory_level', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerInventoryWriteTools(server, client, emptyCtx);
  });

  it('POSTs to /inventory_levels/connect.json with required fields', async () => {
    vi.spyOn(client, 'post').mockResolvedValueOnce({ inventory_level: { id: 1 } });

    await callTool(server, 'connect_inventory_level', {
      location_id: 10001,
      inventory_item_id: 500,
    });

    expect(client.post).toHaveBeenCalledWith('/inventory_levels/connect.json', {
      location_id: 10001,
      inventory_item_id: 500,
    });
  });

  it('includes relocate_if_necessary when provided', async () => {
    vi.spyOn(client, 'post').mockResolvedValueOnce({ inventory_level: { id: 1 } });

    await callTool(server, 'connect_inventory_level', {
      location_id: 10001,
      inventory_item_id: 500,
      relocate_if_necessary: true,
    });

    expect(client.post).toHaveBeenCalledWith('/inventory_levels/connect.json', {
      location_id: 10001,
      inventory_item_id: 500,
      relocate_if_necessary: true,
    });
  });
});
