/**
 * Tests for registerDestructiveResourceTools
 * Tools: delete_price_rule, delete_discount_code, delete_customer, delete_variant
 *
 * Critical: Each test verifies guard behavior:
 *   - empty SAPO_ALLOW_OPS → tool NOT registered
 *   - matching category → tool registered
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import type { GuardContext } from '../../src/guards.js';
import { registerDestructiveResourceTools } from '../../src/tools/destructive-resources.js';

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

const deleteCtx: GuardContext = { allowOps: new Set(['delete']) };
const deleteStrictCtx: GuardContext = { allowOps: new Set(['delete_strict']) };
const wildcardCtx: GuardContext = { allowOps: new Set(['*']) };
const emptyCtx: GuardContext = { allowOps: new Set() };

describe('registerDestructiveResourceTools — guard behavior', () => {
  it('registers NO tools when allowOps is empty', () => {
    const server = makeServer();
    const client = makeClient();
    registerDestructiveResourceTools(server, client, emptyCtx);
    expect(getToolNames(server)).toHaveLength(0);
  });

  it('registers delete tools (delete_price_rule, delete_discount_code) with delete category', () => {
    const server = makeServer();
    const client = makeClient();
    registerDestructiveResourceTools(server, client, deleteCtx);
    const names = getToolNames(server);
    expect(names).toContain('delete_price_rule');
    expect(names).toContain('delete_discount_code');
    expect(names).not.toContain('delete_customer');
    expect(names).not.toContain('delete_variant');
  });

  it('registers delete_strict tools (delete_customer, delete_variant) with delete_strict category', () => {
    const server = makeServer();
    const client = makeClient();
    registerDestructiveResourceTools(server, client, deleteStrictCtx);
    const names = getToolNames(server);
    expect(names).toContain('delete_customer');
    expect(names).toContain('delete_variant');
    expect(names).not.toContain('delete_price_rule');
    expect(names).not.toContain('delete_discount_code');
  });

  it('registers all 4 tools with wildcard allowOps', () => {
    const server = makeServer();
    const client = makeClient();
    registerDestructiveResourceTools(server, client, wildcardCtx);
    expect(getToolNames(server)).toHaveLength(4);
  });
});

describe('delete_price_rule', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerDestructiveResourceTools(server, client, deleteCtx);
  });

  it('DELETEs /price_rules/{id}.json and returns deleted flag', async () => {
    vi.spyOn(client, 'delete').mockResolvedValueOnce(undefined);

    const result = await callTool(server, 'delete_price_rule', {
      confirm: true,
      price_rule_id: 2168108,
    });
    const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(client.delete).toHaveBeenCalledWith('/price_rules/2168108.json');
    expect(text.deleted).toBe(true);
    expect(text.id).toBe(2168108);
  });

  it('returns isError on not found', async () => {
    vi.spyOn(client, 'delete').mockRejectedValueOnce(new SapoNotFoundError('not found', 404));

    const result = await callTool(server, 'delete_price_rule', {
      confirm: true,
      price_rule_id: 999,
    });
    expect(result).toHaveProperty('isError', true);
  });
});

describe('delete_discount_code', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerDestructiveResourceTools(server, client, deleteCtx);
  });

  it('DELETEs nested /price_rules/{pr_id}/discount_codes/{id}.json', async () => {
    vi.spyOn(client, 'delete').mockResolvedValueOnce(undefined);

    const result = await callTool(server, 'delete_discount_code', {
      confirm: true,
      price_rule_id: 2168108,
      discount_code_id: 3315351,
    });
    const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(client.delete).toHaveBeenCalledWith('/price_rules/2168108/discount_codes/3315351.json');
    expect(text.deleted).toBe(true);
    expect(text.id).toBe(3315351);
  });

  it('returns isError on not found', async () => {
    vi.spyOn(client, 'delete').mockRejectedValueOnce(new SapoNotFoundError('not found', 404));

    const result = await callTool(server, 'delete_discount_code', {
      confirm: true,
      price_rule_id: 1,
      discount_code_id: 999,
    });
    expect(result).toHaveProperty('isError', true);
  });
});

describe('delete_customer', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerDestructiveResourceTools(server, client, deleteStrictCtx);
  });

  it('DELETEs /customers/{id}.json and returns deleted flag', async () => {
    vi.spyOn(client, 'delete').mockResolvedValueOnce(undefined);

    const result = await callTool(server, 'delete_customer', {
      confirm: true,
      customer_id: 12345,
    });
    const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(client.delete).toHaveBeenCalledWith('/customers/12345.json');
    expect(text.deleted).toBe(true);
    expect(text.id).toBe(12345);
  });

  it('returns isError on not found', async () => {
    vi.spyOn(client, 'delete').mockRejectedValueOnce(new SapoNotFoundError('not found', 404));

    const result = await callTool(server, 'delete_customer', {
      confirm: true,
      customer_id: 999,
    });
    expect(result).toHaveProperty('isError', true);
  });
});

describe('delete_variant', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerDestructiveResourceTools(server, client, deleteStrictCtx);
  });

  it('DELETEs /products/{pid}/variants/{id}.json and returns deleted flag', async () => {
    vi.spyOn(client, 'delete').mockResolvedValueOnce(undefined);

    const result = await callTool(server, 'delete_variant', {
      confirm: true,
      product_id: 46419129,
      variant_id: 147237422,
    });
    const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

    expect(client.delete).toHaveBeenCalledWith('/products/46419129/variants/147237422.json');
    expect(text.deleted).toBe(true);
    expect(text.id).toBe(147237422);
  });

  it('returns isError on not found', async () => {
    vi.spyOn(client, 'delete').mockRejectedValueOnce(new SapoNotFoundError('not found', 404));

    const result = await callTool(server, 'delete_variant', {
      confirm: true,
      product_id: 1,
      variant_id: 999,
    });
    expect(result).toHaveProperty('isError', true);
  });
});
