/**
 * Pure report functions used by the analytics tools.
 *
 * Each function takes the already-fetched data slice and returns a plain
 * JSON shape. No I/O — all fetching/pagination happens in the tool wrapper.
 *
 * Currency convention:
 *   amounts → integer VND (Math.round at boundary)
 *   rates   → float (e.g. 0.10 for 10%)
 */

import type { InventoryLevel } from '../schemas/inventory.js';
import type { Order } from '../schemas/order.js';
import type { Variant } from '../schemas/variant.js';
import {
  groupBy,
  inDateRange,
  type PeriodGranularity,
  periodKey,
  sumBy,
  topN,
} from './aggregate.js';

// ─── Common ─────────────────────────────────────────────────────────────────

export interface DateRange {
  from?: string;
  to?: string;
}

/** Sapo POS counter source names (channel = physical counter). */
const COUNTER_SOURCES = new Set(['pos', 'pos_counter']);

function isCounter(o: Order): boolean {
  const s = (o.source_name ?? '').toLowerCase();
  return COUNTER_SOURCES.has(s);
}

function vnd(n: number): number {
  return Math.round(n);
}

function avg(total: number, count: number): number {
  if (count <= 0) return 0;
  return vnd(total / count);
}

function applyOrderFilters(
  orders: readonly Order[],
  opts: { range?: DateRange; locationId?: number | null; source?: string },
): Order[] {
  const from = opts.range?.from;
  const to = opts.range?.to;
  return orders.filter((o) => {
    if (!inDateRange(o.created_on, from, to)) return false;
    if (opts.locationId != null && o.location_id !== opts.locationId) return false;
    if (opts.source && (o.source_name ?? '').toLowerCase() !== opts.source.toLowerCase())
      return false;
    return true;
  });
}

// ─── revenue_summary ────────────────────────────────────────────────────────

export interface RevenueSummaryParams {
  range?: DateRange;
  groupBy: PeriodGranularity;
  locationId?: number | null;
  source?: string;
}

export interface RevenueSummaryRow {
  period: string;
  total_revenue: number;
  order_count: number;
  avg_order_value: number;
}

export interface RevenueSummary {
  groups: RevenueSummaryRow[];
  totals: { total_revenue: number; order_count: number; avg_order_value: number };
}

export function revenueSummary(
  orders: readonly Order[],
  params: RevenueSummaryParams,
): RevenueSummary {
  const filtered = applyOrderFilters(orders, params);
  const buckets = groupBy(filtered, (o) => periodKey(o.created_on, params.groupBy));
  const groups: RevenueSummaryRow[] = [];
  for (const [period, items] of buckets) {
    const total = sumBy(items, (o) => o.total_price);
    groups.push({
      period,
      total_revenue: vnd(total),
      order_count: items.length,
      avg_order_value: avg(total, items.length),
    });
  }
  groups.sort((a, b) => a.period.localeCompare(b.period));
  const total = sumBy(filtered, (o) => o.total_price);
  return {
    groups,
    totals: {
      total_revenue: vnd(total),
      order_count: filtered.length,
      avg_order_value: avg(total, filtered.length),
    },
  };
}

// ─── top_products ───────────────────────────────────────────────────────────

export interface TopProductsParams {
  range?: DateRange;
  by: 'revenue' | 'qty';
  limit: number;
  locationId?: number | null;
}

export interface TopProductRow {
  product_id: number | null;
  name: string;
  total_qty: number;
  total_revenue: number;
}

export function topProducts(orders: readonly Order[], params: TopProductsParams): TopProductRow[] {
  const filtered = applyOrderFilters(orders, params);
  const acc = new Map<number | string, TopProductRow>();
  for (const order of filtered) {
    for (const li of order.line_items ?? []) {
      const key: number | string = li.product_id ?? `_unknown_${li.name ?? li.id}`;
      const revenue = (li.discounted_total ?? li.price * li.quantity) || 0;
      const row = acc.get(key);
      if (row) {
        row.total_qty += li.quantity;
        row.total_revenue = vnd(row.total_revenue + revenue);
      } else {
        acc.set(key, {
          product_id: li.product_id ?? null,
          name: li.name ?? li.title ?? 'unknown',
          total_qty: li.quantity,
          total_revenue: vnd(revenue),
        });
      }
    }
  }
  const score =
    params.by === 'qty' ? (r: TopProductRow) => r.total_qty : (r: TopProductRow) => r.total_revenue;
  return topN([...acc.values()], score, params.limit);
}

// ─── top_customers ──────────────────────────────────────────────────────────

export interface TopCustomersParams {
  range?: DateRange;
  by: 'revenue' | 'orders';
  limit: number;
}

export interface TopCustomerRow {
  customer_id: number | null;
  name: string;
  order_count: number;
  total_revenue: number;
}

export function topCustomers(
  orders: readonly Order[],
  params: TopCustomersParams,
): TopCustomerRow[] {
  const filtered = applyOrderFilters(orders, { range: params.range });
  const acc = new Map<number | string, TopCustomerRow>();
  for (const order of filtered) {
    const cid = order.customer?.id ?? null;
    const key: number | string = cid ?? `_guest_${order.email ?? order.phone ?? order.id}`;
    const name = customerName(order);
    const row = acc.get(key);
    if (row) {
      row.order_count += 1;
      row.total_revenue = vnd(row.total_revenue + order.total_price);
    } else {
      acc.set(key, {
        customer_id: cid,
        name,
        order_count: 1,
        total_revenue: vnd(order.total_price),
      });
    }
  }
  const score =
    params.by === 'orders'
      ? (r: TopCustomerRow) => r.order_count
      : (r: TopCustomerRow) => r.total_revenue;
  return topN([...acc.values()], score, params.limit);
}

function customerName(order: Order): string {
  const c = order.customer;
  if (c) {
    const first = (c as { first_name?: string | null }).first_name ?? '';
    const last = (c as { last_name?: string | null }).last_name ?? '';
    const joined = `${first} ${last}`.trim();
    if (joined) return joined;
  }
  return order.email ?? order.phone ?? 'guest';
}

// ─── customer_ltv ───────────────────────────────────────────────────────────

export interface CustomerLtv {
  customer_id: number;
  order_count: number;
  total_revenue: number;
  first_order_on: string | null;
  last_order_on: string | null;
  avg_order_value: number;
}

export function customerLtv(orders: readonly Order[], customerId: number): CustomerLtv {
  const filtered = orders.filter((o) => o.customer?.id === customerId);
  const total = sumBy(filtered, (o) => o.total_price);
  const dates = filtered.map((o) => o.created_on).sort();
  return {
    customer_id: customerId,
    order_count: filtered.length,
    total_revenue: vnd(total),
    first_order_on: dates[0] ?? null,
    last_order_on: dates[dates.length - 1] ?? null,
    avg_order_value: avg(total, filtered.length),
  };
}

// ─── inventory_low_stock ────────────────────────────────────────────────────

export interface LowStockParams {
  threshold: number;
  locationId?: number | null;
}

export interface LowStockRow {
  inventory_item_id: number;
  variant_id: number;
  location_id: number;
  available: number;
  threshold: number;
}

export function inventoryLowStock(
  levels: readonly InventoryLevel[],
  params: LowStockParams,
): LowStockRow[] {
  return levels
    .filter((l) => params.locationId == null || l.location_id === params.locationId)
    .filter((l) => l.available < params.threshold)
    .map((l) => ({
      inventory_item_id: l.inventory_item_id,
      variant_id: l.variant_id,
      location_id: l.location_id,
      available: l.available,
      threshold: params.threshold,
    }))
    .sort((a, b) => a.available - b.available);
}

// ─── inventory_value ────────────────────────────────────────────────────────

export interface InventoryValueParams {
  locationId?: number | null;
}

export interface InventoryValueRow {
  variant_id: number;
  location_id: number;
  available: number;
  unit_price: number;
  value: number;
}

export interface InventoryValueResult {
  total_value: number;
  items: InventoryValueRow[];
  /** Number of variant_ids without price data (excluded from total_value). */
  missing_price_count: number;
}

export function inventoryValue(
  levels: readonly InventoryLevel[],
  variantsById: ReadonlyMap<number, Pick<Variant, 'id' | 'price'>>,
  params: InventoryValueParams,
): InventoryValueResult {
  const filtered = levels.filter(
    (l) => params.locationId == null || l.location_id === params.locationId,
  );
  let missing = 0;
  const items: InventoryValueRow[] = [];
  for (const level of filtered) {
    const variant = variantsById.get(level.variant_id);
    if (!variant || typeof variant.price !== 'number') {
      missing += 1;
      continue;
    }
    items.push({
      variant_id: level.variant_id,
      location_id: level.location_id,
      available: level.available,
      unit_price: vnd(variant.price),
      value: vnd(level.available * variant.price),
    });
  }
  return {
    total_value: items.reduce((s, i) => s + i.value, 0),
    items,
    missing_price_count: missing,
  };
}

// ─── tax_summary ────────────────────────────────────────────────────────────

export interface TaxSummary {
  total_tax: number;
  total_taxable_revenue: number;
  by_rate: Array<{ rate: number; total_tax: number; order_count: number }>;
}

export function taxSummary(orders: readonly Order[], range?: DateRange): TaxSummary {
  const filtered = applyOrderFilters(orders, { range });
  const byRate = new Map<number, { total_tax: number; orderIds: Set<number> }>();
  for (const order of filtered) {
    for (const tl of order.tax_lines ?? []) {
      const rate = typeof tl.rate === 'number' ? tl.rate : 0;
      const tax = typeof tl.price === 'number' ? tl.price : 0;
      const entry = byRate.get(rate);
      if (entry) {
        entry.total_tax += tax;
        entry.orderIds.add(order.id);
      } else {
        byRate.set(rate, { total_tax: tax, orderIds: new Set([order.id]) });
      }
    }
  }
  const rateRows = [...byRate.entries()]
    .map(([rate, { total_tax, orderIds }]) => ({
      rate,
      total_tax: vnd(total_tax),
      order_count: orderIds.size,
    }))
    .sort((a, b) => a.rate - b.rate);
  const totalTax = sumBy(filtered, (o) => o.total_tax ?? 0);
  const subtotal = sumBy(filtered, (o) => o.subtotal_price ?? o.sub_total_price ?? 0);
  return {
    total_tax: vnd(totalTax),
    total_taxable_revenue: vnd(subtotal),
    by_rate: rateRows,
  };
}

// ─── online_vs_counter_breakdown ────────────────────────────────────────────

export interface ChannelBreakdown {
  online: { order_count: number; total_revenue: number };
  counter: { order_count: number; total_revenue: number };
  by_source: Array<{ source: string; order_count: number; total_revenue: number }>;
}

export function onlineVsCounter(orders: readonly Order[], range?: DateRange): ChannelBreakdown {
  const filtered = applyOrderFilters(orders, { range });
  const counter = filtered.filter(isCounter);
  const online = filtered.filter((o) => !isCounter(o));
  const bySrc = groupBy(filtered, (o) => o.source_name ?? 'unknown');
  return {
    online: {
      order_count: online.length,
      total_revenue: vnd(sumBy(online, (o) => o.total_price)),
    },
    counter: {
      order_count: counter.length,
      total_revenue: vnd(sumBy(counter, (o) => o.total_price)),
    },
    by_source: [...bySrc.entries()]
      .map(([source, items]) => ({
        source,
        order_count: items.length,
        total_revenue: vnd(sumBy(items, (o) => o.total_price)),
      }))
      .sort((a, b) => b.total_revenue - a.total_revenue),
  };
}

// ─── discount_usage_report ──────────────────────────────────────────────────

export interface DiscountUsageParams {
  range?: DateRange;
  /** Optional: filter to a specific discount code. */
  code?: string;
}

export interface DiscountUsageRow {
  code: string;
  order_count: number;
  total_discount: number;
  total_revenue: number;
}

export interface DiscountUsageReport {
  totals: { order_count: number; total_discount: number; total_revenue: number };
  codes: DiscountUsageRow[];
}

export function discountUsage(
  orders: readonly Order[],
  params: DiscountUsageParams,
): DiscountUsageReport {
  const filtered = applyOrderFilters(orders, { range: params.range }).filter(
    (o) => (o.discount_codes ?? []).length > 0,
  );
  const acc = new Map<string, DiscountUsageRow>();
  let totalDiscount = 0;
  let totalRevenue = 0;
  let totalOrders = 0;
  for (const order of filtered) {
    const codes = (order.discount_codes ?? []).filter(
      (c) => !params.code || c.code === params.code,
    );
    if (codes.length === 0) continue;
    totalOrders += 1;
    totalRevenue += order.total_price;
    const orderDiscount = sumBy(codes, (c) => c.amount ?? 0);
    totalDiscount += orderDiscount;
    for (const c of codes) {
      const code = c.code ?? 'unknown';
      const amount = c.amount ?? 0;
      const row = acc.get(code);
      if (row) {
        row.order_count += 1;
        row.total_discount = vnd(row.total_discount + amount);
        row.total_revenue = vnd(row.total_revenue + order.total_price);
      } else {
        acc.set(code, {
          code,
          order_count: 1,
          total_discount: vnd(amount),
          total_revenue: vnd(order.total_price),
        });
      }
    }
  }
  return {
    totals: {
      order_count: totalOrders,
      total_discount: vnd(totalDiscount),
      total_revenue: vnd(totalRevenue),
    },
    codes: [...acc.values()].sort((a, b) => b.total_discount - a.total_discount),
  };
}

// ─── shift_report ───────────────────────────────────────────────────────────

export interface ShiftReportInput {
  shift: { id: number } & Record<string, unknown>;
  orders: readonly Order[];
}

export interface ShiftReport {
  shift_id: number;
  orders_count: number;
  total_revenue: number;
  by_payment_method: Array<{ method: string; total: number }>;
  shift: Record<string, unknown>;
}

export function shiftReport(input: ShiftReportInput): ShiftReport {
  const { shift, orders } = input;
  const byMethod = new Map<string, number>();
  let totalRevenue = 0;
  for (const order of orders) {
    totalRevenue += order.total_price;
    const methods = order.payment_gateway_names ?? [];
    if (methods.length === 0) {
      byMethod.set('unknown', (byMethod.get('unknown') ?? 0) + order.total_price);
    } else {
      // Split equally across methods if multiple — simple, conservative.
      const share = order.total_price / methods.length;
      for (const m of methods) byMethod.set(m, (byMethod.get(m) ?? 0) + share);
    }
  }
  return {
    shift_id: shift.id,
    orders_count: orders.length,
    total_revenue: vnd(totalRevenue),
    by_payment_method: [...byMethod.entries()]
      .map(([method, total]) => ({ method, total: vnd(total) }))
      .sort((a, b) => b.total - a.total),
    shift: shift as Record<string, unknown>,
  };
}
