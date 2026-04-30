/**
 * Tests for registerWebTools — mode registration E2E.
 *
 * Verifies correct tool count and key tool presence for Phase 4
 * (Batch A + Batch B + Batch C).
 *
 * Actual tool count breakdown (Phase 4 as implemented):
 *
 *   Batch A: store_info(1) + collections(10: 8R/W + 2D) = 11
 *   Batch B: blogs(5: 4R/W + 1D) + articles(5: 4R/W + 1D) + pages(4: 3R/W + 1D) = 14
 *   Batch C: script_tags(3: 2R/W + 1D) + products_seo(1W) + variants(2R) = 6
 *
 *   TOTAL with all destructive (allowOps=*):  31 tools
 *   TOTAL without destructive (allowOps=''):  25 tools
 *   Destructive gates: delete_custom_collection, delete_collect, delete_blog,
 *                      delete_article, delete_page, delete_script_tag = 6 deletes
 *
 * Note: Phase plan estimated 27 tools. Actual count is 31 because Batches A+B
 * were finalized with more tools than the estimate. Documented in phase report.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import { SapoClient } from '../../src/client/http.js';
import type { SapoConfig } from '../../src/config.js';
import { registerWebTools } from '../../src/modes/web.js';

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

describe('registerWebTools (Phase 4: Batch A + B + C)', () => {
  it('registers without throwing', () => {
    const server = makeServer();
    const client = makeClient();
    expect(() => registerWebTools(server, client, fakeConfig)).not.toThrow();
  });

  it('registers exactly 25 tools with default (empty) allowOps — 6 deletes gated', () => {
    const server = makeServer();
    const client = makeClient();
    registerWebTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    // 31 total - 6 delete tools = 25
    expect(names).toHaveLength(25);
  });

  it('registers exactly 31 tools with SAPO_ALLOW_OPS=* (all destructive)', () => {
    const server = makeServer();
    const client = makeClient();
    registerWebTools(server, client, fullConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toHaveLength(31);
  });

  // ── Spot-check: key tools from the spec ────────────────────────────────────

  it('registers get_store_info', () => {
    const server = makeServer();
    const client = makeClient();
    registerWebTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('get_store_info');
  });

  it('registers list_articles and create_article', () => {
    const server = makeServer();
    const client = makeClient();
    registerWebTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('list_articles');
    expect(names).toContain('create_article');
  });

  it('registers update_product_seo (Batch C)', () => {
    const server = makeServer();
    const client = makeClient();
    registerWebTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('update_product_seo');
  });

  it('registers list_variants_for_product and get_variant (Batch C)', () => {
    const server = makeServer();
    const client = makeClient();
    registerWebTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('list_variants_for_product');
    expect(names).toContain('get_variant');
  });

  // ── Batch A tools ──────────────────────────────────────────────────────────

  it('registers all collection tools', () => {
    const server = makeServer();
    const client = makeClient();
    registerWebTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('list_custom_collections');
    expect(names).toContain('get_custom_collection');
    expect(names).toContain('create_custom_collection');
    expect(names).toContain('update_custom_collection');
    expect(names).toContain('list_smart_collections');
    expect(names).toContain('get_smart_collection');
    expect(names).toContain('list_collects');
    expect(names).toContain('create_collect');
  });

  // ── Batch B tools ──────────────────────────────────────────────────────────

  it('registers all blog tools', () => {
    const server = makeServer();
    const client = makeClient();
    registerWebTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('list_blogs');
    expect(names).toContain('get_blog');
    expect(names).toContain('create_blog');
    expect(names).toContain('update_blog');
  });

  it('registers all page tools', () => {
    const server = makeServer();
    const client = makeClient();
    registerWebTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('list_pages');
    expect(names).toContain('get_page');
    expect(names).toContain('update_page_seo');
  });

  // ── Batch C tools ──────────────────────────────────────────────────────────

  it('registers all script tag tools (read+write)', () => {
    const server = makeServer();
    const client = makeClient();
    registerWebTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('list_script_tags');
    expect(names).toContain('create_script_tag');
  });

  // ── Destructive tools gating ───────────────────────────────────────────────

  it('does NOT register 6 delete tools with empty allowOps', () => {
    const server = makeServer();
    const client = makeClient();
    registerWebTools(server, client, fakeConfig);

    const names = getRegisteredToolNames(server);
    expect(names).not.toContain('delete_custom_collection');
    expect(names).not.toContain('delete_collect');
    expect(names).not.toContain('delete_blog');
    expect(names).not.toContain('delete_article');
    expect(names).not.toContain('delete_page');
    expect(names).not.toContain('delete_script_tag');
  });

  it('registers all 6 delete tools with SAPO_ALLOW_OPS=*', () => {
    const server = makeServer();
    const client = makeClient();
    registerWebTools(server, client, fullConfig);

    const names = getRegisteredToolNames(server);
    expect(names).toContain('delete_custom_collection');
    expect(names).toContain('delete_collect');
    expect(names).toContain('delete_blog');
    expect(names).toContain('delete_article');
    expect(names).toContain('delete_page');
    expect(names).toContain('delete_script_tag');
  });

  it('registers only delete tools with allowOps=delete', () => {
    const deleteConfig: SapoConfig = { ...fakeConfig, allowOps: new Set(['delete']) };
    const server = makeServer();
    const client = makeClient();
    registerWebTools(server, client, deleteConfig);

    const names = getRegisteredToolNames(server);
    // All 6 deletes registered
    expect(names).toContain('delete_custom_collection');
    expect(names).toContain('delete_collect');
    expect(names).toContain('delete_blog');
    expect(names).toContain('delete_article');
    expect(names).toContain('delete_page');
    expect(names).toContain('delete_script_tag');
    // Total: 25 + 6 = 31
    expect(names).toHaveLength(31);
  });

  it('does not throw when web mode loads after pos-online (multi-mode regression)', async () => {
    const { registerPosOnlineTools } = await import('../../src/modes/pos-online.js');
    const server = makeServer();
    const client = makeClient();
    registerPosOnlineTools(server, client, fakeConfig);
    expect(() => registerWebTools(server, client, fakeConfig)).not.toThrow();
    const names = getRegisteredToolNames(server);
    // Variants registered exactly once across both modes.
    expect(names.filter((n) => n === 'list_variants_for_product')).toHaveLength(1);
    expect(names.filter((n) => n === 'get_variant')).toHaveLength(1);
  });

  it('does not throw when pos-online loads after web (reverse order)', async () => {
    const { registerPosOnlineTools } = await import('../../src/modes/pos-online.js');
    const server = makeServer();
    const client = makeClient();
    registerWebTools(server, client, fakeConfig);
    expect(() => registerPosOnlineTools(server, client, fakeConfig)).not.toThrow();
    const names = getRegisteredToolNames(server);
    expect(names.filter((n) => n === 'list_variants_for_product')).toHaveLength(1);
    expect(names.filter((n) => n === 'get_variant')).toHaveLength(1);
  });
});
