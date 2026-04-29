/**
 * Mode: pos-online — online POS operations.
 *
 * Phase 3a (read tools — Batch 1):
 * - Customers: list, get, search, count, list_orders
 * - Customer Addresses: list
 * - Products (read): list, get, search, count
 * - Variants (read): list_for_product, get
 * - Inventory (read): get_levels
 *
 * Phase 3b (read + safe-write — Batch 2):
 * - Orders: list, get, count, search
 * - Order Transactions: list, create
 * - Fulfillments: list, get, create, update_tracking
 * - Order Returns: list, get, create, refund
 *
 * Phase 3c (write + destructive tools — pending):
 * - cancel_order, cancel_fulfillment, cancel_return, close_order
 * - Price Rules, Discount Codes
 * - Customer create/update/delete, Product create/update/delete
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SapoClient } from '../client/http.js';
import type { SapoConfig } from '../config.js';
import { registerCustomerAddressTools } from '../tools/customer-addresses.js';
import { registerCustomerTools } from '../tools/customers.js';
import { registerFulfillmentTools } from '../tools/fulfillments.js';
import { registerInventoryReadTools } from '../tools/inventory-readonly.js';
import { registerOrderReturnTools } from '../tools/order-returns.js';
import { registerOrderTransactionTools } from '../tools/order-transactions.js';
import { registerOrderTools } from '../tools/orders.js';
import { registerProductReadTools } from '../tools/products-readonly.js';
import { registerVariantReadTools } from '../tools/variants-readonly.js';

export function registerPosOnlineTools(
  server: McpServer,
  client: SapoClient,
  _config: SapoConfig,
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
}
