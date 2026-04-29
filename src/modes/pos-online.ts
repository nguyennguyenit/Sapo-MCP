/**
 * Mode: pos-online — online POS operations.
 *
 * Phase 3a (read tools — Batch 1): 13 tools
 * - Customers: list, get, search, count, list_orders
 * - Customer Addresses: list
 * - Products (read): list, get, search, count
 * - Variants (read): list_for_product, get
 * - Inventory (read): get_levels
 *
 * Phase 3b (read + safe-write — Batch 2): 14 tools
 * - Orders: list, get, count, search
 * - Order Transactions: list, create
 * - Fulfillments: list, get, create, update_tracking
 * - Order Returns: list, get, create, refund
 *
 * Phase 3c (write + destructive — Batch 3): 21 tools
 * Read+write (always registered): 12 tools
 * - Draft Orders: list, get, create, update, complete, send_invoice
 * - Price Rules: list, get, create, update
 * - Discount Codes: list, create
 * Destructive (gated via SAPO_ALLOW_OPS): 9 tools
 * - cancel_order, close_order, cancel_fulfillment, cancel_order_return [category: cancel]
 * - delete_draft_order, delete_price_rule, delete_discount_code [category: delete]
 * - delete_customer, delete_variant [category: delete_strict]
 *
 * Tool counts:
 *   Default (SAPO_ALLOW_OPS=''): 39 tools (27 + 12 new read+write)
 *   Full (SAPO_ALLOW_OPS=*):     48 tools (39 + 9 destructive)
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SapoClient } from '../client/http.js';
import type { SapoConfig } from '../config.js';
import type { GuardContext } from '../guards.js';
import { registerCustomerAddressTools } from '../tools/customer-addresses.js';
import { registerCustomerTools } from '../tools/customers.js';
import { registerDestructiveOrderTools } from '../tools/destructive-orders.js';
import { registerDestructiveResourceTools } from '../tools/destructive-resources.js';
import { registerDiscountCodeTools } from '../tools/discount-codes.js';
import { registerDraftOrderTools } from '../tools/draft-orders.js';
import { registerFulfillmentTools } from '../tools/fulfillments.js';
import { registerInventoryReadTools } from '../tools/inventory-readonly.js';
import { registerOrderReturnTools } from '../tools/order-returns.js';
import { registerOrderTransactionTools } from '../tools/order-transactions.js';
import { registerOrderTools } from '../tools/orders.js';
import { registerPriceRuleTools } from '../tools/price-rules.js';
import { registerProductReadTools } from '../tools/products-readonly.js';
import { registerVariantReadTools } from '../tools/variants-readonly.js';

export function registerPosOnlineTools(
  server: McpServer,
  client: SapoClient,
  config: SapoConfig,
): void {
  // Foundation read tools — Phase 3a (13 tools)
  registerCustomerTools(server, client);
  registerCustomerAddressTools(server, client);
  registerProductReadTools(server, client);
  registerVariantReadTools(server, client);
  registerInventoryReadTools(server, client);

  // Orders ecosystem — Phase 3b (14 tools)
  registerOrderTools(server, client); // 4: list, get, count, search
  registerOrderTransactionTools(server, client); // 2: list, create
  registerFulfillmentTools(server, client); // 4: list, get, create, update_tracking
  registerOrderReturnTools(server, client); // 4: list, get, create, refund

  // Draft orders, price rules, discount codes — Phase 3c read+write (12 tools)
  registerDraftOrderTools(server, client); // 6: list, get, create, update, complete, send_invoice
  registerPriceRuleTools(server, client); // 4: list, get, create, update
  registerDiscountCodeTools(server, client); // 2: list, create

  // Destructive tools — Phase 3c, gated via SAPO_ALLOW_OPS (up to 9 tools)
  const guardCtx: GuardContext = { allowOps: config.allowOps };
  registerDestructiveOrderTools(server, client, guardCtx); // 5: cancel_order, close_order, cancel_fulfillment, cancel_order_return, delete_draft_order
  registerDestructiveResourceTools(server, client, guardCtx); // 4: delete_price_rule, delete_discount_code, delete_customer, delete_variant
}
