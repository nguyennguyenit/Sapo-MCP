/**
 * Tests for src/modes/registry.ts
 * Covers: parseModes, registerModes, invalid mode rejection
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import { SapoClient } from '../../src/client/http.js';
import type { SapoConfig } from '../../src/config.js';
import { parseModes, registerModes } from '../../src/modes/registry.js';

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

describe('parseModes', () => {
  it('parses a single valid mode', () => {
    const modes = parseModes('pos-online');
    expect(modes).toEqual(['pos-online']);
  });

  it('parses comma-separated modes', () => {
    const modes = parseModes('pos-online,analytics');
    expect(modes).toEqual(['pos-online', 'analytics']);
  });

  it('handles whitespace around commas', () => {
    const modes = parseModes(' web , analytics ');
    expect(modes).toEqual(['web', 'analytics']);
  });

  it('deduplicates repeated modes', () => {
    const modes = parseModes('pos-online,pos-online');
    expect(modes).toEqual(['pos-online']);
  });

  it('throws on invalid mode name', () => {
    expect(() => parseModes('invalid-mode')).toThrow('Invalid mode(s): invalid-mode');
  });

  it('throws listing all invalid modes', () => {
    expect(() => parseModes('bad1,bad2,pos-online')).toThrow('Invalid mode(s): bad1, bad2');
  });

  it('throws on empty mode string', () => {
    expect(() => parseModes('')).toThrow('At least one mode');
  });

  it('accepts all four valid modes', () => {
    const modes = parseModes('pos-online,pos-counter,web,analytics');
    expect(modes).toHaveLength(4);
  });
});

describe('registerModes', () => {
  it('does not throw for pos-online mode (placeholder)', () => {
    const server = makeServer();
    const client = makeClient();
    expect(() => registerModes(server, ['pos-online'], client, fakeConfig)).not.toThrow();
  });

  it('does not throw for web mode (placeholder)', () => {
    const server = makeServer();
    const client = makeClient();
    expect(() => registerModes(server, ['web'], client, fakeConfig)).not.toThrow();
  });

  it('handles single mode', () => {
    const server = makeServer();
    const client = makeClient();
    expect(() => registerModes(server, ['analytics'], client, fakeConfig)).not.toThrow();
  });

  it('handles all four modes', () => {
    const server = makeServer();
    const client = makeClient();
    expect(() =>
      registerModes(server, ['pos-online', 'pos-counter', 'web', 'analytics'], client, fakeConfig),
    ).not.toThrow();
  });
});
