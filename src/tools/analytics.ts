/**
 * Analytics tool wrappers — Phase 8a.
 *
 * Each tool fetches the minimal data slice via SapoClient (auto-paginating
 * where needed) and delegates to a pure report function in src/analytics/reports.ts.
 *
 * All tools are read-only. Aggregations may be costly for large stores; tools
 * report `truncated: true` when pagination cap is hit so callers know the
 * result is partial.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  customerLtv,
  type DateRange,
  discountUsage,
  inventoryLowStock,
  inventoryValue,
  onlineVsCounter,
  revenueSummary,
  shiftReport,
  taxSummary,
  topCustomers,
  topProducts,
} from '../analytics/reports.js';
import type { SapoClient } from '../client/http.js';
import { paginate } from '../client/pagination.js';
import type { SapoConfig } from '../config.js';
import type { InventoryLevel } from '../schemas/inventory.js';
import type { Order } from '../schemas/order.js';
import type { Variant } from '../schemas/variant.js';
import { okResponse } from './tool-response.js';

const dateRangeShape = {
  from: z.string().optional().describe('Inclusive ISO 8601 start (e.g. "2026-04-01").'),
  to: z.string().optional().describe('Inclusive ISO 8601 end.'),
};

async function fetchOrders(
  client: SapoClient,
  cfg: SapoConfig,
  range: DateRange,
  extra: Record<string, string | number | boolean | undefined> = {},
): Promise<{ orders: Order[]; truncated: boolean }> {
  const params: Record<string, string | number | boolean | undefined> = {
    status: 'any',
    ...extra,
  };
  if (range.from) params.created_on_min = range.from;
  if (range.to) params.created_on_max = range.to;
  const orders = await paginate<Order>(client, '/orders.json', 'orders', {
    pageSize: 250,
    maxPages: cfg.maxAutoPages,
    params,
  });
  // If we hit exactly maxPages * pageSize, assume truncated.
  const truncated = orders.length >= cfg.maxAutoPages * 250;
  return { orders, truncated };
}

export function registerAnalyticsToolsImpl(
  server: McpServer,
  client: SapoClient,
  config: SapoConfig,
): void {
  // ── revenue_summary ───────────────────────────────────────────────────────
  server.registerTool(
    'revenue_summary',
    {
      description:
        'Aggregate order revenue grouped by day/week/month within a date range. Returns groups with total_revenue (VND), order_count, avg_order_value plus overall totals.',
      inputSchema: {
        ...dateRangeShape,
        group_by: z.enum(['day', 'week', 'month']).default('day'),
        location_id: z.number().int().optional(),
        source: z.string().optional().describe('Filter to a single source_name (e.g. "pos").'),
      },
    },
    async (args) => {
      const range: DateRange = { from: args.from, to: args.to };
      const { orders, truncated } = await fetchOrders(client, config, range);
      const result = revenueSummary(orders, {
        range,
        groupBy: args.group_by ?? 'day',
        locationId: args.location_id ?? null,
        source: args.source,
      });
      return okResponse({ ...result, truncated });
    },
  );

  // ── top_products ──────────────────────────────────────────────────────────
  server.registerTool(
    'top_products',
    {
      description:
        'Top selling products by revenue or quantity within a date range, walking line_items across all matching orders.',
      inputSchema: {
        ...dateRangeShape,
        by: z.enum(['revenue', 'qty']).default('revenue'),
        limit: z.number().int().min(1).max(100).default(10),
        location_id: z.number().int().optional(),
      },
    },
    async (args) => {
      const range: DateRange = { from: args.from, to: args.to };
      const { orders, truncated } = await fetchOrders(client, config, range);
      const items = topProducts(orders, {
        range,
        by: args.by ?? 'revenue',
        limit: args.limit ?? 10,
        locationId: args.location_id ?? null,
      });
      return okResponse({ items, truncated });
    },
  );

  // ── top_customers ─────────────────────────────────────────────────────────
  server.registerTool(
    'top_customers',
    {
      description:
        'Top customers ranked by total revenue or order count within a date range. Guests grouped by email/phone.',
      inputSchema: {
        ...dateRangeShape,
        by: z.enum(['revenue', 'orders']).default('revenue'),
        limit: z.number().int().min(1).max(100).default(10),
      },
    },
    async (args) => {
      const range: DateRange = { from: args.from, to: args.to };
      const { orders, truncated } = await fetchOrders(client, config, range);
      const items = topCustomers(orders, {
        range,
        by: args.by ?? 'revenue',
        limit: args.limit ?? 10,
      });
      return okResponse({ items, truncated });
    },
  );

  // ── customer_ltv ──────────────────────────────────────────────────────────
  server.registerTool(
    'customer_ltv',
    {
      description:
        'Lifetime value for a single customer: total revenue, order count, first/last order date.',
      inputSchema: {
        customer_id: z.number().int().describe('Sapo customer ID.'),
      },
    },
    async (args) => {
      const orders = await paginate<Order>(client, '/orders.json', 'orders', {
        pageSize: 250,
        maxPages: config.maxAutoPages,
        params: { customer_id: args.customer_id, status: 'any' },
      });
      return okResponse(customerLtv(orders, args.customer_id));
    },
  );

  // ── inventory_low_stock ───────────────────────────────────────────────────
  server.registerTool(
    'inventory_low_stock',
    {
      description: 'Inventory levels with available stock below a threshold, sorted ascending.',
      inputSchema: {
        threshold: z.number().min(0).describe('Available quantity threshold (exclusive).'),
        location_id: z.number().int().optional(),
      },
    },
    async (args) => {
      const levels = await paginate<InventoryLevel>(
        client,
        '/inventory_levels.json',
        'inventory_levels',
        { pageSize: 250, maxPages: config.maxAutoPages },
      );
      const items = inventoryLowStock(levels, {
        threshold: args.threshold,
        locationId: args.location_id ?? null,
      });
      return okResponse({ items });
    },
  );

  // ── inventory_value ───────────────────────────────────────────────────────
  server.registerTool(
    'inventory_value',
    {
      description:
        'Total inventory value (Σ available × variant.price) optionally scoped to a location. Variants without price data are reported under missing_price_count.',
      inputSchema: {
        location_id: z.number().int().optional(),
      },
    },
    async (args) => {
      const levels = await paginate<InventoryLevel>(
        client,
        '/inventory_levels.json',
        'inventory_levels',
        { pageSize: 250, maxPages: config.maxAutoPages },
      );
      const variants = await paginate<Variant>(client, '/variants.json', 'variants', {
        pageSize: 250,
        maxPages: config.maxAutoPages,
      });
      const variantsById = new Map(variants.map((v) => [v.id, v]));
      const result = inventoryValue(levels, variantsById, {
        locationId: args.location_id ?? null,
      });
      return okResponse(result);
    },
  );

  // ── tax_summary ───────────────────────────────────────────────────────────
  server.registerTool(
    'tax_summary',
    {
      description: 'Tax totals over a date range, broken down by tax rate.',
      inputSchema: { ...dateRangeShape },
    },
    async (args) => {
      const range: DateRange = { from: args.from, to: args.to };
      const { orders, truncated } = await fetchOrders(client, config, range);
      return okResponse({ ...taxSummary(orders, range), truncated });
    },
  );

  // ── online_vs_counter_breakdown ───────────────────────────────────────────
  server.registerTool(
    'online_vs_counter_breakdown',
    {
      description:
        'Compare physical POS counter sales vs online sales within a date range. Counter = source_name in {"pos", "pos_counter"}; everything else is online.',
      inputSchema: { ...dateRangeShape },
    },
    async (args) => {
      const range: DateRange = { from: args.from, to: args.to };
      const { orders, truncated } = await fetchOrders(client, config, range);
      return okResponse({ ...onlineVsCounter(orders, range), truncated });
    },
  );

  // ── discount_usage_report ─────────────────────────────────────────────────
  server.registerTool(
    'discount_usage_report',
    {
      description:
        'Discount code usage within a date range: per-code order count, total discount amount, total revenue. Filter by code if specified.',
      inputSchema: {
        ...dateRangeShape,
        code: z.string().optional().describe('Restrict report to this discount code.'),
      },
    },
    async (args) => {
      const range: DateRange = { from: args.from, to: args.to };
      const { orders, truncated } = await fetchOrders(client, config, range);
      return okResponse({ ...discountUsage(orders, { range, code: args.code }), truncated });
    },
  );

  // ── shift_report ──────────────────────────────────────────────────────────
  server.registerTool(
    'shift_report',
    {
      description:
        '[UNDOCUMENTED endpoint, verified 2026-04-30, schema may change] Shift summary: orders count, total revenue, breakdown by payment method. Cashbook NOT included (internal-only endpoint).',
      inputSchema: {
        shift_id: z.number().int(),
      },
    },
    async (args) => {
      const shift = (await client.get<Record<string, unknown>>(
        `/pos_shifts/${args.shift_id}.json`,
      )) as {
        pos_shift?: { id: number } & Record<string, unknown>;
      };
      const shiftObj = shift.pos_shift;
      if (!shiftObj) {
        return okResponse({ error: 'shift_not_found', shift_id: args.shift_id });
      }
      const orders = await paginate<Order>(client, '/orders.json', 'orders', {
        pageSize: 250,
        maxPages: config.maxAutoPages,
        params: { pos_shift_id: args.shift_id, status: 'any' },
      });
      return okResponse(shiftReport({ shift: shiftObj, orders }));
    },
  );
}
