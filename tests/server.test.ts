/**
 * Tests for src/server.ts — createServer factory
 * Covers: valid mode creation, invalid mode rejection
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import type { SapoConfig } from '../src/config.js';
import { createServer } from '../src/server.js';

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

describe('createServer', () => {
  it('returns an McpServer instance for a valid mode', () => {
    const server = createServer({ modes: 'pos-online', config: fakeConfig });
    expect(server).toBeInstanceOf(McpServer);
  });

  it('accepts array of modes', () => {
    const server = createServer({ modes: ['web', 'analytics'], config: fakeConfig });
    expect(server).toBeInstanceOf(McpServer);
  });

  it('accepts comma-separated mode string', () => {
    const server = createServer({ modes: 'pos-online,web', config: fakeConfig });
    expect(server).toBeInstanceOf(McpServer);
  });

  it('throws on invalid mode string', () => {
    expect(() => createServer({ modes: 'nonexistent-mode', config: fakeConfig })).toThrow(
      'Invalid mode',
    );
  });

  it('creates server without throwing for placeholder modes', () => {
    // All 4 modes are placeholders in Phase 2; server creates successfully with no tools
    expect(() => createServer({ modes: 'pos-online', config: fakeConfig })).not.toThrow();
  });
});
