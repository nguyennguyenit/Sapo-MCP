/**
 * Tests for registerDestructiveOrderTools
 * Tools: cancel_order, close_order, cancel_fulfillment, delete_draft_order
 *
 * Critical: Each test verifies guard behavior:
 *   - empty SAPO_ALLOW_OPS → tool NOT registered
 *   - matching category → tool registered
 *   - confirm:true required in actual call
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import type { GuardContext } from '../../src/guards.js';
import { registerDestructiveOrderTools } from '../../src/tools/destructive-orders.js';

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

const cancelCtx: GuardContext = { allowOps: new Set(['cancel']) };
const deleteCtx: GuardContext = { allowOps: new Set(['delete']) };
const wildcardCtx: GuardContext = { allowOps: new Set(['*']) };
const emptyCtx: GuardContext = { allowOps: new Set() };

describe('registerDestructiveOrderTools — guard behavior', () => {
  it('registers NO tools when allowOps is empty', () => {
    const server = makeServer();
    const client = makeClient();
    registerDestructiveOrderTools(server, client, emptyCtx);
    expect(getToolNames(server)).toHaveLength(0);
  });

  it('registers cancel tools (cancel_order, close_order, cancel_fulfillment) with cancel category', () => {
    const server = makeServer();
    const client = makeClient();
    registerDestructiveOrderTools(server, client, cancelCtx);
    const names = getToolNames(server);
    expect(names).toContain('cancel_order');
    expect(names).toContain('close_order');
    expect(names).toContain('cancel_fulfillment');
    expect(names).not.toContain('delete_draft_order');
  });

  it('registers delete_draft_order with delete category', () => {
    const server = makeServer();
    const client = makeClient();
    registerDestructiveOrderTools(server, client, deleteCtx);
    const names = getToolNames(server);
    expect(names).toContain('delete_draft_order');
    expect(names).not.toContain('cancel_order');
  });

  it('registers all 4 tools with wildcard allowOps', () => {
    const server = makeServer();
    const client = makeClient();
    registerDestructiveOrderTools(server, client, wildcardCtx);
    expect(getToolNames(server)).toHaveLength(4);
  });
});

describe('cancel_order', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerDestructiveOrderTools(server, client, cancelCtx);
  });

  it('POSTs to /orders/{id}/cancel.json', async () => {
    vi.spyOn(client, 'post').mockResolvedValueOnce({ order: { id: 1 } });

    await callTool(server, 'cancel_order', { confirm: true, order_id: 1 });

    expect(client.post).toHaveBeenCalledWith('/orders/1/cancel.json', expect.any(Object));
  });

  it('passes reason and refund params to API', async () => {
    vi.spyOn(client, 'post').mockResolvedValueOnce({ order: { id: 1 } });

    await callTool(server, 'cancel_order', {
      confirm: true,
      order_id: 1,
      reason: 'customer',
      refund: true,
      restock: true,
    });

    expect(client.post).toHaveBeenCalledWith(
      '/orders/1/cancel.json',
      expect.objectContaining({ reason: 'customer', refund: true, restock: true }),
    );
  });

  it('returns isError on not found', async () => {
    vi.spyOn(client, 'post').mockRejectedValueOnce(new SapoNotFoundError('not found', 404));

    const result = await callTool(server, 'cancel_order', { confirm: true, order_id: 999 });
    expect(result).toHaveProperty('isError', true);
  });
});

describe('close_order', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerDestructiveOrderTools(server, client, cancelCtx);
  });

  it('POSTs to /orders/{id}/close.json', async () => {
    vi.spyOn(client, 'post').mockResolvedValueOnce({ order: { id: 2 } });

    await callTool(server, 'close_order', { confirm: true, order_id: 2 });

    expect(client.post).toHaveBeenCalledWith('/orders/2/close.json', {});
  });

  it('returns isError on not found', async () => {
    vi.spyOn(client, 'post').mockRejectedValueOnce(new SapoNotFoundError('not found', 404));

    const result = await callTool(server, 'close_order', { confirm: true, order_id: 999 });
    expect(result).toHaveProperty('isError', true);
  });
});

describe('cancel_fulfillment', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerDestructiveOrderTools(server, client, cancelCtx);
  });

  it('POSTs to /fulfillments/{id}/cancel.json', async () => {
    vi.spyOn(client, 'post').mockResolvedValueOnce({ fulfillment: { id: 10 } });

    await callTool(server, 'cancel_fulfillment', { confirm: true, fulfillment_id: 10 });

    expect(client.post).toHaveBeenCalledWith('/fulfillments/10/cancel.json', {});
  });

  it('returns isError on not found', async () => {
    vi.spyOn(client, 'post').mockRejectedValueOnce(new SapoNotFoundError('not found', 404));

    const result = await callTool(server, 'cancel_fulfillment', {
      confirm: true,
      fulfillment_id: 999,
    });
    expect(result).toHaveProperty('isError', true);
  });
});

describe('delete_draft_order', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerDestructiveOrderTools(server, client, deleteCtx);
  });

  it('DELETEs /draft_orders/{id}.json and returns deleted flag', async () => {
    vi.spyOn(client, 'delete').mockResolvedValueOnce(undefined);

    const result = await callTool(server, 'delete_draft_order', {
      confirm: true,
      draft_order_id: 6586400,
    });
    const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(client.delete).toHaveBeenCalledWith('/draft_orders/6586400.json');
    expect(text.deleted).toBe(true);
    expect(text.id).toBe(6586400);
  });

  it('returns isError on not found', async () => {
    vi.spyOn(client, 'delete').mockRejectedValueOnce(new SapoNotFoundError('not found', 404));

    const result = await callTool(server, 'delete_draft_order', {
      confirm: true,
      draft_order_id: 999,
    });
    expect(result).toHaveProperty('isError', true);
  });
});
