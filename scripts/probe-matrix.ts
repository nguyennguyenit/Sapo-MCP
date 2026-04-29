/**
 * Probe matrix — exhaustive list of endpoints to test.
 *
 * Bucket A: Smoke tests — confirmed Sapo Admin API endpoints.
 *           All should return 200 if credentials are valid.
 * Bucket B: Verification targets — POS-specific endpoints with uncertain availability.
 *           Used to decide Phase 6 (pos-counter) scope (decision gate G1).
 *
 * All entries use GET (read-only). Write probe uses separate write-matrix.
 */

export type ProbeBucket = 'A' | 'B';

export interface ProbeEntry {
  /** Logical resource name for reporting. */
  resource: string;
  /** Full path starting with /admin/ (query params included). */
  endpoint: string;
  method: 'GET';
  /** If true, auth failure on this endpoint triggers immediate early exit. */
  critical?: boolean;
  /** A = smoke/confirmed, B = uncertain/POS-specific. */
  bucket: ProbeBucket;
  /** Human notes shown in verify-report.md. */
  notes?: string;
}

/**
 * Bucket A: Smoke test endpoints (confirmed in Sapo Admin API reference).
 * Paginated with limit=1 to minimise data transfer and avoid rate limits.
 */
const BUCKET_A: ProbeEntry[] = [
  {
    resource: 'store',
    endpoint: '/admin/store.json',
    method: 'GET',
    critical: true,
    bucket: 'A',
    notes:
      'Single-resource endpoint; 401 here = auth completely broken. Sapo uses /admin/store.json (NOT /admin/shop.json — that returns 403 even with full perms)',
  },
  {
    resource: 'products',
    endpoint: '/admin/products.json?limit=1',
    method: 'GET',
    bucket: 'A',
  },
  {
    resource: 'orders',
    endpoint: '/admin/orders.json?limit=1',
    method: 'GET',
    bucket: 'A',
  },
  {
    resource: 'customers',
    endpoint: '/admin/customers.json?limit=1',
    method: 'GET',
    bucket: 'A',
  },
  {
    resource: 'custom_collections',
    endpoint: '/admin/custom_collections.json?limit=1',
    method: 'GET',
    bucket: 'A',
  },
  {
    resource: 'smart_collections',
    endpoint: '/admin/smart_collections.json?limit=1',
    method: 'GET',
    bucket: 'A',
  },
  {
    resource: 'inventory_levels',
    endpoint: '/admin/inventory_levels.json?limit=1',
    method: 'GET',
    bucket: 'A',
    notes: 'Read-only in Sapo Admin API',
  },
  {
    resource: 'locations',
    endpoint: '/admin/locations.json',
    method: 'GET',
    bucket: 'A',
    notes: 'Read-only in Sapo Admin API',
  },
  {
    resource: 'draft_orders',
    endpoint: '/admin/draft_orders.json?limit=1',
    method: 'GET',
    bucket: 'A',
  },
  {
    resource: 'webhooks',
    endpoint: '/admin/webhooks.json?limit=1',
    method: 'GET',
    bucket: 'A',
  },
  {
    resource: 'price_rules',
    endpoint: '/admin/price_rules.json?limit=1',
    method: 'GET',
    bucket: 'A',
  },
  {
    resource: 'pages',
    endpoint: '/admin/pages.json?limit=1',
    method: 'GET',
    bucket: 'A',
  },
];

/**
 * Bucket B: POS-specific endpoints — existence uncertain.
 * Results drive Gate G1 (Phase 6 scope decision).
 * Also includes alias path attempts for resources with unclear URL patterns.
 */
const BUCKET_B: ProbeEntry[] = [
  // Core POS resources
  {
    resource: 'suppliers',
    endpoint: '/admin/suppliers.json?limit=1',
    method: 'GET',
    bucket: 'B',
    notes: 'Webhook topic confirmed; REST CRUD uncertain',
  },
  {
    resource: 'purchase_orders',
    endpoint: '/admin/purchase_orders.json?limit=1',
    method: 'GET',
    bucket: 'B',
  },
  {
    resource: 'pos_shifts',
    endpoint: '/admin/pos_shifts.json?limit=1',
    method: 'GET',
    bucket: 'B',
    notes: 'POS cash register shift management',
  },
  {
    resource: 'cash_transactions',
    endpoint: '/admin/cash_transactions.json?limit=1',
    method: 'GET',
    bucket: 'B',
    notes: 'Cash in/out journal; endpoint name uncertain',
  },
  {
    resource: 'stock_transfers',
    endpoint: '/admin/stock_transfers.json?limit=1',
    method: 'GET',
    bucket: 'B',
  },
  {
    resource: 'stock_adjustments',
    endpoint: '/admin/stock_adjustments.json?limit=1',
    method: 'GET',
    bucket: 'B',
  },
  {
    resource: 'purchase_returns',
    endpoint: '/admin/purchase_returns.json?limit=1',
    method: 'GET',
    bucket: 'B',
  },
  {
    resource: 'payment_methods',
    endpoint: '/admin/payment_methods.json',
    method: 'GET',
    bucket: 'B',
    notes: 'Read-only in Sapo Admin API reference',
  },
  // Alias attempts — alternative URL patterns that Sapo might use
  {
    resource: 'pos_shifts',
    endpoint: '/admin/pos/shifts.json?limit=1',
    method: 'GET',
    bucket: 'B',
    notes: 'Alias: /admin/pos/ namespace variant',
  },
  {
    resource: 'cash_transactions',
    endpoint: '/admin/payments/cashbook.json?limit=1',
    method: 'GET',
    bucket: 'B',
    notes: 'Alias: /admin/payments/ namespace variant for cashbook',
  },
  {
    resource: 'cashbook',
    endpoint: '/admin/cashbook.json?limit=1',
    method: 'GET',
    bucket: 'B',
    notes: 'Alias: direct cashbook endpoint (reference shows this name)',
  },
];

/**
 * Full probe matrix — Bucket A first (smoke), then Bucket B (verification).
 * Runner processes A before B; 401 on any critical entry triggers early exit.
 */
export const PROBE_MATRIX: ProbeEntry[] = [...BUCKET_A, ...BUCKET_B];
