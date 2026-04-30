/**
 * Report function tests — fixture-driven.
 *
 * Each test uses a small handcrafted Order/Inventory array so the expected
 * outputs are obvious. Reports never call the network.
 */

import { describe, expect, it } from 'vitest';
import {
  customerLtv,
  discountUsage,
  inventoryLowStock,
  inventoryValue,
  onlineVsCounter,
  revenueSummary,
  shiftReport,
  taxSummary,
  topCustomers,
  topProducts,
} from '../../src/analytics/reports.js';
import type { InventoryLevel } from '../../src/schemas/inventory.js';
import type { Order } from '../../src/schemas/order.js';
import type { Variant } from '../../src/schemas/variant.js';

// ── helpers ────────────────────────────────────────────────────────────────
type OrderInput = Partial<Order> & {
  id: number;
  created_on: string;
  total_price: number;
  line_items?: Array<Partial<Order['line_items'][number]>>;
};

function makeOrder(o: OrderInput): Order {
  return {
    currency: 'VND',
    financial_status: 'paid',
    modified_on: o.created_on,
    line_items: [],
    ...o,
  } as unknown as Order;
}

const baseLi = (
  product_id: number,
  name: string,
  qty: number,
  price: number,
): Partial<Order['line_items'][number]> => ({
  id: product_id * 100,
  product_id,
  variant_id: product_id,
  name,
  title: name,
  quantity: qty,
  price,
  discounted_total: qty * price,
});

// ── revenue_summary ────────────────────────────────────────────────────────
describe('revenueSummary', () => {
  const orders: Order[] = [
    makeOrder({ id: 1, created_on: '2026-04-01T08:00:00Z', total_price: 100_000 }),
    makeOrder({ id: 2, created_on: '2026-04-01T20:00:00Z', total_price: 200_000 }),
    makeOrder({ id: 3, created_on: '2026-04-02T09:00:00Z', total_price: 300_000 }),
    makeOrder({ id: 4, created_on: '2026-05-01T09:00:00Z', total_price: 400_000 }),
  ];

  it('groups by day and sums total_price', () => {
    const result = revenueSummary(orders, {
      groupBy: 'day',
      range: { from: '2026-04-01', to: '2026-04-30' },
    });
    expect(result.groups).toEqual([
      {
        period: '2026-04-01',
        total_revenue: 300_000,
        order_count: 2,
        avg_order_value: 150_000,
      },
      {
        period: '2026-04-02',
        total_revenue: 300_000,
        order_count: 1,
        avg_order_value: 300_000,
      },
    ]);
    expect(result.totals).toEqual({
      total_revenue: 600_000,
      order_count: 3,
      avg_order_value: 200_000,
    });
  });

  it('groups by month including all periods inside range', () => {
    const result = revenueSummary(orders, {
      groupBy: 'month',
      range: { from: '2026-04-01', to: '2026-05-31' },
    });
    expect(result.groups.map((g) => g.period)).toEqual(['2026-04', '2026-05']);
    expect(result.totals.order_count).toBe(4);
  });

  it('filters by source_name', () => {
    const mixed: Order[] = [
      makeOrder({ id: 1, created_on: '2026-04-01', total_price: 100_000, source_name: 'web' }),
      makeOrder({ id: 2, created_on: '2026-04-01', total_price: 200_000, source_name: 'pos' }),
    ];
    const result = revenueSummary(mixed, { groupBy: 'day', source: 'pos' });
    expect(result.totals.total_revenue).toBe(200_000);
  });

  it('returns empty groups when range excludes everything', () => {
    const result = revenueSummary(orders, {
      groupBy: 'day',
      range: { from: '2027-01-01' },
    });
    expect(result.groups).toEqual([]);
    expect(result.totals.order_count).toBe(0);
    expect(result.totals.avg_order_value).toBe(0);
  });
});

// ── top_products ───────────────────────────────────────────────────────────
describe('topProducts', () => {
  const orders: Order[] = [
    makeOrder({
      id: 1,
      created_on: '2026-04-01',
      total_price: 100_000,
      line_items: [baseLi(10, 'A', 2, 50_000), baseLi(20, 'B', 1, 100_000)],
    }),
    makeOrder({
      id: 2,
      created_on: '2026-04-02',
      total_price: 100_000,
      line_items: [baseLi(10, 'A', 3, 50_000)],
    }),
  ];

  it('ranks by revenue', () => {
    const top = topProducts(orders, { by: 'revenue', limit: 5 });
    expect(top.map((p) => p.product_id)).toEqual([10, 20]);
    expect(top[0]).toMatchObject({ product_id: 10, total_qty: 5, total_revenue: 250_000 });
  });

  it('ranks by qty', () => {
    const top = topProducts(orders, { by: 'qty', limit: 5 });
    expect(top.map((p) => p.product_id)).toEqual([10, 20]);
    expect(top[0].total_qty).toBe(5);
  });

  it('respects limit', () => {
    expect(topProducts(orders, { by: 'revenue', limit: 1 })).toHaveLength(1);
  });
});

// ── top_customers ──────────────────────────────────────────────────────────
describe('topCustomers', () => {
  const c = (id: number, first: string) =>
    ({ id, first_name: first, last_name: 'X' }) as unknown as Order['customer'];
  const orders: Order[] = [
    makeOrder({ id: 1, created_on: '2026-04-01', total_price: 500_000, customer: c(1, 'Alice') }),
    makeOrder({ id: 2, created_on: '2026-04-02', total_price: 300_000, customer: c(1, 'Alice') }),
    makeOrder({ id: 3, created_on: '2026-04-03', total_price: 1_000_000, customer: c(2, 'Bob') }),
  ];

  it('ranks by revenue', () => {
    const top = topCustomers(orders, { by: 'revenue', limit: 5 });
    expect(top.map((c) => c.customer_id)).toEqual([2, 1]);
    expect(top[0]).toMatchObject({ customer_id: 2, name: 'Bob X', total_revenue: 1_000_000 });
  });

  it('ranks by orders', () => {
    const top = topCustomers(orders, { by: 'orders', limit: 5 });
    expect(top[0].customer_id).toBe(1);
    expect(top[0].order_count).toBe(2);
  });

  it('groups guest orders separately by email/phone', () => {
    const guests: Order[] = [
      makeOrder({ id: 10, created_on: '2026-04-01', total_price: 10, email: 'a@x.com' }),
      makeOrder({ id: 11, created_on: '2026-04-01', total_price: 20, email: 'a@x.com' }),
      makeOrder({ id: 12, created_on: '2026-04-01', total_price: 30, email: 'b@x.com' }),
    ];
    const top = topCustomers(guests, { by: 'orders', limit: 5 });
    expect(top.find((r) => r.name === 'a@x.com')?.order_count).toBe(2);
  });
});

// ── customer_ltv ───────────────────────────────────────────────────────────
describe('customerLtv', () => {
  const c = (id: number) => ({ id }) as unknown as Order['customer'];
  it('aggregates orders for a single customer', () => {
    const orders: Order[] = [
      makeOrder({ id: 1, created_on: '2026-01-01', total_price: 100_000, customer: c(7) }),
      makeOrder({ id: 2, created_on: '2026-04-01', total_price: 300_000, customer: c(7) }),
      makeOrder({ id: 3, created_on: '2026-04-01', total_price: 999, customer: c(99) }),
    ];
    expect(customerLtv(orders, 7)).toEqual({
      customer_id: 7,
      order_count: 2,
      total_revenue: 400_000,
      first_order_on: '2026-01-01',
      last_order_on: '2026-04-01',
      avg_order_value: 200_000,
    });
  });

  it('returns zeros when customer has no orders', () => {
    expect(customerLtv([], 1)).toEqual({
      customer_id: 1,
      order_count: 0,
      total_revenue: 0,
      first_order_on: null,
      last_order_on: null,
      avg_order_value: 0,
    });
  });
});

// ── inventory_low_stock ───────────────────────────────────────────────────
describe('inventoryLowStock', () => {
  const lvl = (id: number, available: number, location_id = 1): InventoryLevel =>
    ({
      id,
      variant_id: id,
      inventory_item_id: id * 10,
      location_id,
      on_hand: available,
      available,
    }) as unknown as InventoryLevel;

  it('returns levels below threshold sorted ascending by available', () => {
    const result = inventoryLowStock([lvl(1, 0), lvl(2, 5), lvl(3, 100)], { threshold: 10 });
    expect(result.map((r) => r.variant_id)).toEqual([1, 2]);
    expect(result[0].available).toBe(0);
  });

  it('filters by location_id when provided', () => {
    const levels = [lvl(1, 1, 1), lvl(2, 1, 2)];
    const result = inventoryLowStock(levels, { threshold: 10, locationId: 2 });
    expect(result.map((r) => r.variant_id)).toEqual([2]);
  });
});

// ── inventory_value ────────────────────────────────────────────────────────
describe('inventoryValue', () => {
  const lvl = (variant_id: number, available: number, location_id = 1): InventoryLevel =>
    ({
      id: variant_id,
      variant_id,
      inventory_item_id: variant_id * 10,
      location_id,
      on_hand: available,
      available,
    }) as unknown as InventoryLevel;
  const v = (id: number, price: number) => ({ id, price }) as Pick<Variant, 'id' | 'price'>;

  it('computes total_value as sum of available * price', () => {
    const variants = new Map([
      [1, v(1, 100_000)],
      [2, v(2, 50_000)],
    ]);
    const result = inventoryValue([lvl(1, 5), lvl(2, 4)], variants, {});
    expect(result.total_value).toBe(700_000);
    expect(result.items).toHaveLength(2);
    expect(result.missing_price_count).toBe(0);
  });

  it('skips levels missing variant price and counts them', () => {
    const variants = new Map([[1, v(1, 100_000)]]);
    const result = inventoryValue([lvl(1, 1), lvl(2, 1)], variants, {});
    expect(result.total_value).toBe(100_000);
    expect(result.missing_price_count).toBe(1);
  });
});

// ── tax_summary ────────────────────────────────────────────────────────────
describe('taxSummary', () => {
  const tl = (price: number, rate: number) => ({ price, rate, title: `VAT ${rate * 100}%` });
  it('aggregates tax per rate', () => {
    const orders: Order[] = [
      makeOrder({
        id: 1,
        created_on: '2026-04-01',
        total_price: 110_000,
        subtotal_price: 100_000,
        total_tax: 10_000,
        tax_lines: [tl(10_000, 0.1)] as Order['tax_lines'],
      }),
      makeOrder({
        id: 2,
        created_on: '2026-04-02',
        total_price: 220_000,
        subtotal_price: 200_000,
        total_tax: 20_000,
        tax_lines: [tl(20_000, 0.1)] as Order['tax_lines'],
      }),
    ];
    const result = taxSummary(orders);
    expect(result.total_tax).toBe(30_000);
    expect(result.total_taxable_revenue).toBe(300_000);
    expect(result.by_rate).toEqual([{ rate: 0.1, total_tax: 30_000, order_count: 2 }]);
  });

  it('handles orders with no tax_lines', () => {
    const result = taxSummary([makeOrder({ id: 1, created_on: '2026-04-01', total_price: 0 })]);
    expect(result.by_rate).toEqual([]);
  });
});

// ── online_vs_counter ──────────────────────────────────────────────────────
describe('onlineVsCounter', () => {
  it('splits by source_name into online vs counter buckets', () => {
    const orders: Order[] = [
      makeOrder({ id: 1, created_on: '2026-04-01', total_price: 100, source_name: 'pos' }),
      makeOrder({ id: 2, created_on: '2026-04-01', total_price: 200, source_name: 'web' }),
      makeOrder({ id: 3, created_on: '2026-04-01', total_price: 300, source_name: 'facebook' }),
    ];
    const result = onlineVsCounter(orders);
    expect(result.counter).toEqual({ order_count: 1, total_revenue: 100 });
    expect(result.online).toEqual({ order_count: 2, total_revenue: 500 });
    // Sorted by revenue desc
    expect(result.by_source[0].source).toBe('facebook');
  });
});

// ── discount_usage ─────────────────────────────────────────────────────────
describe('discountUsage', () => {
  const dc = (code: string, amount: number) => ({ code, amount });
  it('aggregates per discount code', () => {
    const orders: Order[] = [
      makeOrder({
        id: 1,
        created_on: '2026-04-01',
        total_price: 90_000,
        discount_codes: [dc('SUMMER', 10_000)] as Order['discount_codes'],
      }),
      makeOrder({
        id: 2,
        created_on: '2026-04-02',
        total_price: 80_000,
        discount_codes: [dc('SUMMER', 20_000)] as Order['discount_codes'],
      }),
      makeOrder({ id: 3, created_on: '2026-04-03', total_price: 100 }),
    ];
    const result = discountUsage(orders, {});
    expect(result.totals.order_count).toBe(2);
    expect(result.totals.total_discount).toBe(30_000);
    expect(result.codes).toEqual([
      { code: 'SUMMER', order_count: 2, total_discount: 30_000, total_revenue: 170_000 },
    ]);
  });

  it('filters to a specific code when provided', () => {
    const orders: Order[] = [
      makeOrder({
        id: 1,
        created_on: '2026-04-01',
        total_price: 100,
        discount_codes: [dc('A', 10), dc('B', 20)] as Order['discount_codes'],
      }),
    ];
    const result = discountUsage(orders, { code: 'A' });
    expect(result.codes.map((c) => c.code)).toEqual(['A']);
    expect(result.totals.total_discount).toBe(10);
  });
});

// ── shift_report ──────────────────────────────────────────────────────────
describe('shiftReport', () => {
  it('aggregates orders, distributing revenue across payment methods', () => {
    const orders: Order[] = [
      makeOrder({
        id: 1,
        created_on: '2026-04-01',
        total_price: 100_000,
        payment_gateway_names: ['cash'],
      }),
      makeOrder({
        id: 2,
        created_on: '2026-04-01',
        total_price: 200_000,
        payment_gateway_names: ['cash', 'card'],
      }),
    ];
    const report = shiftReport({ shift: { id: 42 }, orders });
    expect(report.shift_id).toBe(42);
    expect(report.orders_count).toBe(2);
    expect(report.total_revenue).toBe(300_000);
    // cash: 100k + 100k = 200k; card: 100k
    expect(report.by_payment_method).toEqual([
      { method: 'cash', total: 200_000 },
      { method: 'card', total: 100_000 },
    ]);
  });

  it('uses "unknown" bucket when payment methods missing', () => {
    const report = shiftReport({
      shift: { id: 1 },
      orders: [makeOrder({ id: 1, created_on: '2026-04-01', total_price: 50_000 })],
    });
    expect(report.by_payment_method).toEqual([{ method: 'unknown', total: 50_000 }]);
  });
});
