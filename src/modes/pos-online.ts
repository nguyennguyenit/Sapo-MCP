/**
 * Mode: pos-online — placeholder for Phase 3 implementation.
 *
 * This mode provides tools for online POS operations:
 * orders, customers, fulfillments, draft orders, price rules, etc.
 *
 * Tools will be implemented in Phase 3 (TDD).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SapoClient } from '../client/http.js';
import type { SapoConfig } from '../config.js';

export function registerPosOnlineTools(
  _server: McpServer,
  _client: SapoClient,
  _config: SapoConfig,
): void {
  // Phase 3: implement 40+ tools for pos-online mode
  // Tools: list_orders, get_order, create_order, cancel_order,
  //        list_customers, get_customer, create_customer, update_customer,
  //        list_fulfillments, create_fulfillment, list_draft_orders, etc.
}
