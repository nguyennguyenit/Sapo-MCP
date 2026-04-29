/**
 * Mode: pos-counter — placeholder for Phase 6 implementation.
 *
 * This mode provides tools for POS counter operations:
 * suppliers, purchase orders, stock transfers, POS shifts, cashbook.
 *
 * Gated on Phase 1 probe results (Gate G1). Tools implemented in Phase 6.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SapoClient } from '../client/http.js';
import type { SapoConfig } from '../config.js';

export function registerPosCounterTools(
  _server: McpServer,
  _client: SapoClient,
  _config: SapoConfig,
): void {
  // Phase 6: implement 50+ tools for pos-counter mode
  // Gated on Phase 1 verification probe results (Gate G1)
  // Tools: list_suppliers, create_supplier, list_purchase_orders,
  //        create_purchase_order, list_stock_transfers, open_pos_shift, etc.
}
