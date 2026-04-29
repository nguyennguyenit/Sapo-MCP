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

describe('registerPosOnlineTools (Phase 3a + 3b)', () => {
  it('registers without throwing', () => {
    const server = makeServer();
    const client = makeClient();
    expect(() => registerPosOnlineTools(server, client, fakeConfig)).not.toThrow();
  });

  it('registers exactly 27 tools after Phase 3a + 3b', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosOnlineTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    // Phase 3a (13): 5 customer + 1 address + 4 product + 2 variant + 1 inventory
    // Phase 3b (14): 4 orders + 2 transactions + 4 fulfillments + 4 order-returns
    // Total: 27
    expect(names).toHaveLength(27);
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

  it('registers all Phase 3b order tools', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosOnlineTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('list_orders');
    expect(names).toContain('get_order');
    expect(names).toContain('count_orders');
    expect(names).toContain('search_orders');
  });

  it('registers all Phase 3b transaction tools', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosOnlineTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('list_order_transactions');
    expect(names).toContain('create_order_transaction');
  });

  it('registers all Phase 3b fulfillment tools', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosOnlineTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('list_fulfillments_for_order');
    expect(names).toContain('get_fulfillment');
    expect(names).toContain('create_fulfillment');
    expect(names).toContain('update_fulfillment_tracking');
  });

  it('registers all Phase 3b order return tools', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosOnlineTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('list_order_returns');
    expect(names).toContain('get_order_return');
    expect(names).toContain('create_order_return');
    expect(names).toContain('refund_order_return');
  });
});
