/**
 * Mode: pos-counter — POS bán tại quầy (physical store counter operations).
 *
 * Phase 6 tools — 15 total across 8 resources:
 *
 * Read tools (always registered): 14
 *   Locations (UNDOC):        list_locations, get_location                  (2)
 *   Payment Methods (UNDOC):  list_payment_methods                          (1)
 *   Inventory write (safe):   adjust_inventory_level, connect_inventory_level (2)
 *   Variants write:           update_variant                                (1)
 *   POS Orders:               list_pos_orders, get_pos_order                (2)
 *   Suppliers (UNDOC):        list_suppliers, get_supplier                  (2)
 *   POS Shifts (UNDOC):       list_pos_shifts, get_pos_shift                (2)
 *   Stock Transfers (UNDOC):  list_stock_transfers, get_stock_transfer       (2)
 *
 * Destructive tools (gated via SAPO_ALLOW_OPS): 1
 *   set_inventory_level — category: inventory_set (absolute quantity overwrite)
 *
 * Tool counts:
 *   Default (SAPO_ALLOW_OPS=''):  14 tools
 *   Full (SAPO_ALLOW_OPS=*):      15 tools
 *
 * NOTE: pos-counter does NOT register customers/products read tools.
 * For full read access combine with pos-online: --mode=pos-online,pos-counter.
 * This avoids duplicate tool registration when both modes run together.
 *
 * 4 UNDOCUMENTED endpoints (verified 2026-04-30): locations, payment_methods,
 * suppliers, pos_shifts, stock_transfers. See README for warning block.
 * 5 internal-only endpoints excluded: purchase_orders, purchase_returns,
 * stock_adjustments, cash_transactions, cashbook. See out-of-scope.md.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SapoClient } from '../client/http.js';
import type { SapoConfig } from '../config.js';
import type { GuardContext } from '../guards.js';
import { registerInventoryWriteTools } from '../tools/inventory-write.js';
import { registerLocationTools } from '../tools/locations.js';
import { registerOrdersCounterTools } from '../tools/orders-counter.js';
import { registerPaymentMethodTools } from '../tools/payment-methods.js';
import { registerPosShiftTools } from '../tools/pos-shifts.js';
import { registerStockTransferTools } from '../tools/stock-transfers.js';
import { registerSupplierTools } from '../tools/suppliers.js';
import { registerVariantWriteTools } from '../tools/variants-write.js';

export function registerPosCounterTools(
  server: McpServer,
  client: SapoClient,
  config: SapoConfig,
): void {
  const guardCtx: GuardContext = { allowOps: config.allowOps };

  // Read + safe-write tools (always registered)
  registerLocationTools(server, client); // 2: list_locations, get_location
  registerPaymentMethodTools(server, client); // 1: list_payment_methods
  registerInventoryWriteTools(server, client, guardCtx); // 2 safe + 1 destructive
  registerVariantWriteTools(server, client); // 1: update_variant
  registerOrdersCounterTools(server, client); // 2: list_pos_orders, get_pos_order
  registerSupplierTools(server, client); // 2: list_suppliers, get_supplier
  registerPosShiftTools(server, client); // 2: list_pos_shifts, get_pos_shift
  registerStockTransferTools(server, client); // 2: list_stock_transfers, get_stock_transfer
}
