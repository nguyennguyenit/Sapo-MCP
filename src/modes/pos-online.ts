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
 * Phase 3b/3c (write + destructive tools — pending):
 * - Orders, Draft Orders, Fulfillments, Returns, Transactions
 * - Price Rules, Discount Codes
 * - Customer create/update/delete, Product create/update/delete
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SapoClient } from '../client/http.js';
import type { SapoConfig } from '../config.js';
import { registerCustomerAddressTools } from '../tools/customer-addresses.js';
import { registerCustomerTools } from '../tools/customers.js';
import { registerInventoryReadTools } from '../tools/inventory-readonly.js';
import { registerProductReadTools } from '../tools/products-readonly.js';
import { registerVariantReadTools } from '../tools/variants-readonly.js';

export function registerPosOnlineTools(
  server: McpServer,
  client: SapoClient,
  _config: SapoConfig,
): void {
  // Foundation read tools — Phase 3a
  registerCustomerTools(server, client);
  registerCustomerAddressTools(server, client);
  registerProductReadTools(server, client);
  registerVariantReadTools(server, client);
  registerInventoryReadTools(server, client);
}
