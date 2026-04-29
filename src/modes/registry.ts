/**
 * Mode registry: maps mode name → tool registration function.
 *
 * Modes are placeholders in Phase 2; actual tools are registered in Phase 3+.
 * Supports comma-separated mode strings for multi-mode servers.
 *
 * Example: createServer(['pos-online', 'analytics'])
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SapoClient } from '../client/http.js';
import type { SapoConfig } from '../config.js';
import { registerAnalyticsTools } from './analytics.js';
import { registerPosCounterTools } from './pos-counter.js';
import { registerPosOnlineTools } from './pos-online.js';
import { registerWebTools } from './web.js';

export type ModeName = 'pos-online' | 'pos-counter' | 'web' | 'analytics';

const VALID_MODES: Set<ModeName> = new Set(['pos-online', 'pos-counter', 'web', 'analytics']);

export type ModeRegistrar = (server: McpServer, client: SapoClient, config: SapoConfig) => void;

const MODE_REGISTRARS: Record<ModeName, ModeRegistrar> = {
  'pos-online': registerPosOnlineTools,
  'pos-counter': registerPosCounterTools,
  web: registerWebTools,
  analytics: registerAnalyticsTools,
};

/**
 * Parse a comma-separated mode string into validated mode names.
 * Throws if any mode is invalid.
 */
export function parseModes(modeArg: string): ModeName[] {
  const parts = modeArg
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    throw new Error('At least one mode must be specified');
  }

  const invalid = parts.filter((m) => !VALID_MODES.has(m as ModeName));
  if (invalid.length > 0) {
    throw new Error(
      `Invalid mode(s): ${invalid.join(', ')}. Valid modes: ${[...VALID_MODES].join(', ')}`,
    );
  }

  // Deduplicate while preserving order
  return [...new Set(parts as ModeName[])];
}

/**
 * Register all tools for the given modes onto the MCP server.
 * Each mode's registrar is called once even if specified multiple times.
 */
export function registerModes(
  server: McpServer,
  modes: ModeName[],
  client: SapoClient,
  config: SapoConfig,
): void {
  for (const mode of modes) {
    const registrar = MODE_REGISTRARS[mode];
    registrar(server, client, config);
  }
}
