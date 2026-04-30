/**
 * Tests for registerPosOnlineTools — mode registration
 * Verifies correct tool count for Phase 3a + 3b + 3c.
 *
 * Tool count expectations:
 *   Default (allowOps=empty): 39 tools (27 Phase3a+3b + 12 Phase3c read+write)
 *   Full (allowOps=*):        48 tools (39 + 9 destructive)
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
  http: {
    host: '127.0.0.1',
    port: 3333,
    maxSessions: 100,
    sessionIdleMs: 1_800_000,
    authToken: undefined,
    corsOrigins: [],
  },
};

const fullConfig: SapoConfig = {
  ...fakeConfig,
  allowOps: new Set(['*']),
};

function getRegisteredToolNames(server: McpServer): string[] {
  const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
    ._registeredTools;
  return Object.keys(tools);
}

describe('registerPosOnlineTools (Phase 3a + 3b + 3c)', () => {
  it('registers without throwing', () => {
    const server = makeServer();
    const client = makeClient();
    expect(() => registerPosOnlineTools(server, client, fakeConfig)).not.toThrow();
  });

  it('registers exactly 39 tools with default (empty) allowOps', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosOnlineTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    // Phase 3a (13): 5 customer + 1 address + 4 product + 2 variant + 1 inventory
    // Phase 3b (14): 4 orders + 2 transactions + 4 fulfillments + 4 order-returns
    // Phase 3c read+write (12): 6 draft-orders + 4 price-rules + 2 discount-codes
    // Destructive (0): gated, not registered
    expect(names).toHaveLength(39);
  });

  it('registers exactly 48 tools with SAPO_ALLOW_OPS=*', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosOnlineTools(server, client, fullConfig);

    const names = getRegisteredToolNames(server);
    // 39 read+write + 9 destructive
    expect(names).toHaveLength(48);
  });

  // ── Phase 3a tools ────────────────────────────────────────────────────────────

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

  // ── Phase 3b tools ────────────────────────────────────────────────────────────

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

  // ── Phase 3c read+write tools ────────────────────────────────────────────────

  it('registers all Phase 3c draft order tools', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosOnlineTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('list_draft_orders');
    expect(names).toContain('get_draft_order');
    expect(names).toContain('create_draft_order');
    expect(names).toContain('update_draft_order');
    expect(names).toContain('complete_draft_order');
    expect(names).toContain('send_draft_order_invoice');
  });

  it('registers all Phase 3c price rule tools', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosOnlineTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('list_price_rules');
    expect(names).toContain('get_price_rule');
    expect(names).toContain('create_price_rule');
    expect(names).toContain('update_price_rule');
  });

  it('registers all Phase 3c discount code tools', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosOnlineTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('list_discount_codes');
    expect(names).toContain('create_discount_code');
  });

  // ── Phase 3c destructive tools (gated) ──────────────────────────────────────

  it('does NOT register destructive tools by default (empty allowOps)', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosOnlineTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).not.toContain('cancel_order');
    expect(names).not.toContain('close_order');
    expect(names).not.toContain('cancel_fulfillment');
    expect(names).not.toContain('cancel_order_return');
    expect(names).not.toContain('delete_draft_order');
    expect(names).not.toContain('delete_price_rule');
    expect(names).not.toContain('delete_discount_code');
    expect(names).not.toContain('delete_customer');
    expect(names).not.toContain('delete_variant');
  });

  it('registers all 9 destructive tools with SAPO_ALLOW_OPS=*', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosOnlineTools(server, client, fullConfig);

    const names = getRegisteredToolNames(server);
    // cancel category (4)
    expect(names).toContain('cancel_order');
    expect(names).toContain('close_order');
    expect(names).toContain('cancel_fulfillment');
    expect(names).toContain('cancel_order_return');
    // delete category (3)
    expect(names).toContain('delete_draft_order');
    expect(names).toContain('delete_price_rule');
    expect(names).toContain('delete_discount_code');
    // delete_strict category (2)
    expect(names).toContain('delete_customer');
    expect(names).toContain('delete_variant');
  });

  it('registers only cancel tools with allowOps=cancel', () => {
    const cancelConfig: SapoConfig = { ...fakeConfig, allowOps: new Set(['cancel']) };
    const server = makeServer();
    const client = makeClient();
    registerPosOnlineTools(server, client, cancelConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('cancel_order');
    expect(names).toContain('close_order');
    expect(names).toContain('cancel_fulfillment');
    expect(names).toContain('cancel_order_return');
    expect(names).not.toContain('delete_draft_order');
    expect(names).not.toContain('delete_customer');
    // Total: 39 + 4 = 43
    expect(names).toHaveLength(43);
  });

  it('registers only delete tools with allowOps=delete', () => {
    const deleteConfig: SapoConfig = { ...fakeConfig, allowOps: new Set(['delete']) };
    const server = makeServer();
    const client = makeClient();
    registerPosOnlineTools(server, client, deleteConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('delete_draft_order');
    expect(names).toContain('delete_price_rule');
    expect(names).toContain('delete_discount_code');
    expect(names).not.toContain('cancel_order');
    expect(names).not.toContain('delete_customer');
    // Total: 39 + 3 = 42
    expect(names).toHaveLength(42);
  });

  it('registers only delete_strict tools with allowOps=delete_strict', () => {
    const strictConfig: SapoConfig = { ...fakeConfig, allowOps: new Set(['delete_strict']) };
    const server = makeServer();
    const client = makeClient();
    registerPosOnlineTools(server, client, strictConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('delete_customer');
    expect(names).toContain('delete_variant');
    expect(names).not.toContain('cancel_order');
    expect(names).not.toContain('delete_draft_order');
    // Total: 39 + 2 = 41
    expect(names).toHaveLength(41);
  });
});
