/**
 * Tests for registerPosOnlineTools — mode registration
 * Verifies correct tool count for Phase 3a (read-only tools).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import { SapoClient } from '../../src/client/http.js';
import type { SapoConfig } from '../../src/config.js';
import { registerPosOnlineTools } from '../../src/modes/pos-online.js';

function makeServer(): McpServer {
  return new McpServer({ name: 'test', version: '0.0.0' });
}

function makeClient(): SapoClient {
  return new SapoClient({
    store: 'testshop',
    apiKey: 'key',
    apiSecret: 'secret',
  });
}

const fakeConfig: SapoConfig = {
  store: 'testshop',
  apiKey: 'key',
  apiSecret: 'secret',
  allowOps: new Set(),
  maxAutoPages: 10,
  retryMax: 3,
  logLevel: 'info',
  logPii: false,
};

function getRegisteredToolNames(server: McpServer): string[] {
  const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
    ._registeredTools;
  return Object.keys(tools);
}

describe('registerPosOnlineTools (Phase 3a)', () => {
  it('registers without throwing', () => {
    const server = makeServer();
    const client = makeClient();
    expect(() => registerPosOnlineTools(server, client, fakeConfig)).not.toThrow();
  });

  it('registers exactly 11 read tools in Phase 3a', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosOnlineTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    // Phase 3a tools: 5 customer + 1 address + 4 product + 2 variant + 1 inventory = 13
    // But spec says: list_customers, get_customer, search_customers, count_customers, list_customer_orders (5)
    // + list_customer_addresses (1)
    // + list_products, get_product, search_products, count_products (4)
    // + list_variants_for_product, get_variant (2)
    // + get_inventory_levels (1) = 13 total
    expect(names).toHaveLength(13);
  });

  it('registers all expected customer tools', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosOnlineTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('list_customers');
    expect(names).toContain('get_customer');
    expect(names).toContain('search_customers');
    expect(names).toContain('count_customers');
    expect(names).toContain('list_customer_orders');
  });

  it('registers address tool', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosOnlineTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('list_customer_addresses');
  });

  it('registers all expected product tools', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosOnlineTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('list_products');
    expect(names).toContain('get_product');
    expect(names).toContain('search_products');
    expect(names).toContain('count_products');
  });

  it('registers variant tools', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosOnlineTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('list_variants_for_product');
    expect(names).toContain('get_variant');
  });

  it('registers inventory tool', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosOnlineTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('get_inventory_levels');
  });
});
