/**
 * Mode: analytics — placeholder for Phase 8 implementation.
 *
 * This mode provides composed analytics tools:
 * revenue summary, top products, LTV analysis, low stock alerts.
 *
 * Tools will be implemented in Phase 8 (composed from pos-online data).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SapoClient } from '../client/http.js';
import type { SapoConfig } from '../config.js';

export function registerAnalyticsTools(
  _server: McpServer,
  _client: SapoClient,
  _config: SapoConfig,
): void {
  // Phase 8a: implement 9 Bucket-A analytics tools
  // Phase 8b: implement 6 Bucket-B analytics tools (requires pos-counter)
  // Tools: revenue_summary, top_products_by_revenue, low_stock_alert,
  //        customer_ltv, order_fulfillment_rate, etc.
}
