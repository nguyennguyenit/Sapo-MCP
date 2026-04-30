/**
 * Tests for registerPosCounterTools — mode registration (Phase 6)
 *
 * Tool count expectations:
 *   Default (allowOps=empty): 14 tools (all except set_inventory_level)
 *   Full (allowOps=*):        15 tools (14 + 1 destructive)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import { SapoClient } from '../../src/client/http.js';
import type { SapoConfig } from '../../src/config.js';
import { registerPosCounterTools } from '../../src/modes/pos-counter.js';

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

const inventorySetConfig: SapoConfig = {
  ...fakeConfig,
  allowOps: new Set(['inventory_set']),
};

function getRegisteredToolNames(server: McpServer): string[] {
  const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
    ._registeredTools;
  return Object.keys(tools);
}

describe('registerPosCounterTools (Phase 6)', () => {
  it('registers without throwing', () => {
    const server = makeServer();
    const client = makeClient();
    expect(() => registerPosCounterTools(server, client, fakeConfig)).not.toThrow();
  });

  it('registers exactly 14 tools with default (empty) allowOps', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosCounterTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    // Locations (2): list_locations, get_location
    // Payment Methods (1): list_payment_methods
    // Inventory safe (2): adjust_inventory_level, connect_inventory_level
    // Variants write (1): update_variant
    // POS Orders (2): list_pos_orders, get_pos_order
    // Suppliers (2): list_suppliers, get_supplier
    // POS Shifts (2): list_pos_shifts, get_pos_shift
    // Stock Transfers (2): list_stock_transfers, get_stock_transfer
    // Destructive (0): set_inventory_level gated
    expect(names).toHaveLength(14);
  });

  it('registers exactly 15 tools with SAPO_ALLOW_OPS=*', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosCounterTools(server, client, fullConfig);

    const names = getRegisteredToolNames(server);
    // 14 + 1 destructive (set_inventory_level)
    expect(names).toHaveLength(15);
  });

  // ── Location tools ────────────────────────────────────────────────────────────

  it('registers location tools', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosCounterTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('list_locations');
    expect(names).toContain('get_location');
  });

  // ── Payment method tools ──────────────────────────────────────────────────────

  it('registers payment method tools', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosCounterTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('list_payment_methods');
  });

  // ── Inventory write tools ─────────────────────────────────────────────────────

  it('registers safe inventory write tools by default', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosCounterTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('adjust_inventory_level');
    expect(names).toContain('connect_inventory_level');
    expect(names).not.toContain('set_inventory_level');
  });

  it('registers set_inventory_level with inventory_set allowOps', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosCounterTools(server, client, inventorySetConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('set_inventory_level');
    // Total: 14 + 1 = 15
    expect(names).toHaveLength(15);
  });

  // ── Variant write tools ───────────────────────────────────────────────────────

  it('registers update_variant (safe write)', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosCounterTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('update_variant');
  });

  // ── POS order tools ───────────────────────────────────────────────────────────

  it('registers POS order tools', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosCounterTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('list_pos_orders');
    expect(names).toContain('get_pos_order');
  });

  // ── Supplier tools (UNDOC) ────────────────────────────────────────────────────

  it('registers supplier tools', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosCounterTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('list_suppliers');
    expect(names).toContain('get_supplier');
  });

  // ── POS shift tools (UNDOC) ───────────────────────────────────────────────────

  it('registers POS shift tools', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosCounterTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('list_pos_shifts');
    expect(names).toContain('get_pos_shift');
  });

  // ── Stock transfer tools (UNDOC) ──────────────────────────────────────────────

  it('registers stock transfer tools', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosCounterTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('list_stock_transfers');
    expect(names).toContain('get_stock_transfer');
  });

  // ── Boundary: destructive check ───────────────────────────────────────────────

  it('does NOT register set_inventory_level by default', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosCounterTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).not.toContain('set_inventory_level');
  });

  it('does NOT register customers/products tools (those belong to pos-online)', () => {
    const server = makeServer();
    const client = makeClient();
    registerPosCounterTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).not.toContain('list_customers');
    expect(names).not.toContain('list_products');
    expect(names).not.toContain('list_orders');
  });
});
