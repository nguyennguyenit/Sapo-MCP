/**
 * Mode: analytics — composed read-only reporting tools (Phase 8a).
 *
 * Registers 10 composed tools that aggregate data from pos-online and
 * pos-counter endpoints into reports. All tools are read-only.
 *
 * Phase 8b (cashflow / pnl / supplier_purchase / daily_pos_report) is
 * deferred to post-1.0.0 — those endpoints are internal-only and
 * forbidden for Private App credentials. See out-of-scope.md.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SapoClient } from '../client/http.js';
import type { SapoConfig } from '../config.js';
import { registerAnalyticsToolsImpl } from '../tools/analytics.js';

export function registerAnalyticsTools(
  server: McpServer,
  client: SapoClient,
  config: SapoConfig,
): void {
  registerAnalyticsToolsImpl(server, client, config);
}
