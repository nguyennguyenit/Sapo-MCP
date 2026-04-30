/**
 * Tests for registerAnalyticsTools — Phase 8a.
 * Verifies all 10 analytics tools register on the MCP server.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import { SapoClient } from '../../src/client/http.js';
import type { SapoConfig } from '../../src/config.js';
import { registerAnalyticsTools } from '../../src/modes/analytics.js';

function makeServer(): McpServer {
  return new McpServer({ name: 'test', version: '0.0.0' });
}

function makeClient(): SapoClient {
  return new SapoClient({ store: 's', apiKey: 'k', apiSecret: 'x' });
}

const fakeConfig: SapoConfig = {
  store: 's',
  apiKey: 'k',
  apiSecret: 'x',
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

function getRegisteredToolNames(server: McpServer): string[] {
  return Object.keys(
    (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools,
  );
}

const EXPECTED = [
  'revenue_summary',
  'top_products',
  'top_customers',
  'customer_ltv',
  'inventory_low_stock',
  'inventory_value',
  'tax_summary',
  'online_vs_counter_breakdown',
  'discount_usage_report',
  'shift_report',
];

describe('registerAnalyticsTools (Phase 8a)', () => {
  it('registers without throwing', () => {
    const server = makeServer();
    expect(() => registerAnalyticsTools(server, makeClient(), fakeConfig)).not.toThrow();
  });

  it('registers exactly 10 tools', () => {
    const server = makeServer();
    registerAnalyticsTools(server, makeClient(), fakeConfig);
    expect(getRegisteredToolNames(server)).toHaveLength(EXPECTED.length);
  });

  it.each(EXPECTED)('registers %s', (name) => {
    const server = makeServer();
    registerAnalyticsTools(server, makeClient(), fakeConfig);
    expect(getRegisteredToolNames(server)).toContain(name);
  });

  it('does not register destructive tools (analytics is read-only)', () => {
    const server = makeServer();
    registerAnalyticsTools(server, makeClient(), fakeConfig);
    const names = getRegisteredToolNames(server);
    for (const n of names) {
      expect(n).not.toMatch(/^delete_|^cancel_|^close_/);
    }
  });
});
