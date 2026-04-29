/**
 * MCP server factory: creates and configures a McpServer for the given modes.
 *
 * Usage:
 *   const server = createServer(['pos-online', 'web'], config);
 *   await server.connect(transport);
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SapoClient } from './client/http.js';
import type { SapoConfig } from './config.js';
import { type ModeName, parseModes, registerModes } from './modes/registry.js';

// Package version — updated by changeset releases
const SERVER_VERSION = '0.0.0';

export interface ServerCreateOptions {
  /** Pre-parsed mode list or comma-separated mode string */
  modes: ModeName[] | string;
  config: SapoConfig;
}

/**
 * Create and configure an McpServer instance for the given modes.
 * Registers all tools from each mode's registrar.
 */
export function createServer(opts: ServerCreateOptions): McpServer {
  const modeList: ModeName[] = typeof opts.modes === 'string' ? parseModes(opts.modes) : opts.modes;

  const server = new McpServer({
    name: 'sapo-mcp',
    version: SERVER_VERSION,
  });

  const client = new SapoClient({
    store: opts.config.store,
    apiKey: opts.config.apiKey,
    apiSecret: opts.config.apiSecret,
    retryMax: opts.config.retryMax,
  });

  registerModes(server, modeList, client, opts.config);

  return server;
}
