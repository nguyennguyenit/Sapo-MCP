/**
 * Canary — schema drift detection against live Sapo store.
 *
 * Runs nightly via `.github/workflows/canary.yml`. Local: `npm run canary`.
 *
 * Strategy:
 *   1. Reachability check: hit each endpoint, must return 200 (or known 403 for internal-only).
 *   2. Schema validation: parse response with the same Zod schema tools use.
 *      A safeParse failure = required field changed type or disappeared = real drift.
 *      Schemas use `.passthrough()` so additive fields don't trigger false positives.
 *
 * Exit codes:
 *   0 = all green (schemas parse, endpoints 200)
 *   2 = auth failure (early exit, do not file issue)
 *   3 = drift detected (one or more schema safeParse failures)
 *   1 = fatal error
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { CustomerListResponseSchema } from '../src/schemas/customer.js';
import { DraftOrderListResponseSchema } from '../src/schemas/draft-order.js';
import { InventoryLevelListResponseSchema } from '../src/schemas/inventory.js';
import { LocationListResponseSchema } from '../src/schemas/location.js';
import { OrderListResponseSchema } from '../src/schemas/order.js';
import { PageListResponseSchema } from '../src/schemas/page.js';
import { PaymentMethodListResponseSchema } from '../src/schemas/payment-method.js';
import { PriceRuleListResponseSchema } from '../src/schemas/price-rule.js';
import { ProductListResponseSchema } from '../src/schemas/product.js';
import { StockTransferListResponseSchema } from '../src/schemas/stock-transfer.js';
import { SupplierListResponseSchema } from '../src/schemas/supplier.js';
import { buildBasicAuthHeader, log, maskCredentials } from './probe-shared.js';

async function fetchJson(url: string, auth: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON response, leave body as null
  }
  return { status: res.status, body };
}

interface CanaryEntry {
  resource: string;
  endpoint: string;
  schema: z.ZodType<unknown>;
}

// Inline schemas for administrative-units canary entries — kept here to avoid
// re-exposing them publicly; mirror src/tools/administrative-units.ts.
const ProvinceListCanarySchema = z
  .object({
    provinces: z.array(
      z.object({ id: z.number().int(), name: z.string(), code: z.string() }).passthrough(),
    ),
  })
  .passthrough();
const WardListCanarySchema = z
  .object({
    wards: z.array(
      z
        .object({
          id: z.number().int(),
          name: z.string(),
          code: z.string(),
          district_code: z.string().optional().nullable(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

// Single-resource (no list wrapper) handled separately.
const StoreSingleSchema = z
  .object({ store: z.object({ id: z.number() }).passthrough() })
  .passthrough();

const CANARY_MATRIX: CanaryEntry[] = [
  {
    resource: 'products',
    endpoint: '/admin/products.json?limit=1',
    schema: ProductListResponseSchema,
  },
  { resource: 'orders', endpoint: '/admin/orders.json?limit=1', schema: OrderListResponseSchema },
  {
    resource: 'customers',
    endpoint: '/admin/customers.json?limit=1',
    schema: CustomerListResponseSchema,
  },
  {
    resource: 'inventory_levels',
    endpoint: '/admin/inventory_levels.json?limit=1',
    schema: InventoryLevelListResponseSchema,
  },
  { resource: 'locations', endpoint: '/admin/locations.json', schema: LocationListResponseSchema },
  {
    resource: 'draft_orders',
    endpoint: '/admin/draft_orders.json?limit=1',
    schema: DraftOrderListResponseSchema,
  },
  {
    resource: 'price_rules',
    endpoint: '/admin/price_rules.json?limit=1',
    schema: PriceRuleListResponseSchema,
  },
  { resource: 'pages', endpoint: '/admin/pages.json?limit=1', schema: PageListResponseSchema },
  {
    resource: 'suppliers',
    endpoint: '/admin/suppliers.json?limit=1',
    schema: SupplierListResponseSchema,
  },
  // KNOWN ISSUE 2026-04-30: /admin/pos_shifts.json returns text/html (Sapo POS web app shell),
  // not JSON. Tools list_pos_shifts / get_pos_shift may be non-functional.
  // Removed from canary until either the JSON API is found or tools are deprecated.
  // See memory: sapo-api-quirks.md
  // { resource: 'pos_shifts', endpoint: '/admin/pos_shifts.json?limit=1', schema: PosShiftListResponseSchema },
  {
    resource: 'stock_transfers',
    endpoint: '/admin/stock_transfers.json?limit=1',
    schema: StockTransferListResponseSchema,
  },
  {
    resource: 'payment_methods',
    endpoint: '/admin/payment_methods.json',
    schema: PaymentMethodListResponseSchema,
  },
  // Vietnamese administrative units — drift detection for both 3-tier (default) and 2-tier (level=2) schemas.
  {
    resource: 'provinces_level3',
    endpoint: '/admin/provinces.json',
    schema: ProvinceListCanarySchema,
  },
  {
    resource: 'provinces_level2',
    endpoint: '/admin/provinces.json?level=2',
    schema: ProvinceListCanarySchema,
  },
  // wards level=2 needs a province_code; HN code 2001 is stable post-reform anchor.
  {
    resource: 'wards_level2_hanoi',
    endpoint: '/admin/wards.json?level=2&province_code=2001',
    schema: WardListCanarySchema,
  },
];

/**
 * Optional write-lock probe: confirms Sapo write API still rejects level=2 codes.
 * Gated by env CANARY_PROBE_WRITE=1 + CANARY_CUSTOMER_ID=<id>. Default: skipped.
 *
 * Sapo returns 422 on the level=2 ward — NO database row is created (verified 2026-05-01).
 * If this probe ever returns 200/201, Sapo has opened level=2 write → canary alert →
 * delete src/tools/address-write-validation.ts and add `level` param to write tools.
 */
async function probeWriteLock(
  baseUrl: string,
  auth: string,
  customerId: string,
): Promise<{ stillLocked: boolean; httpStatus: number; body: unknown }> {
  const url = `${baseUrl}/admin/customers/${customerId}/addresses.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({
      address: {
        address1: '[CANARY] level=2 write-lock probe — DO NOT USE',
        city: 'Hà Nội',
        country: 'Vietnam',
        province: 'Hà Nội',
        province_code: '2001',
        ward: 'Phường Hoàn Kiếm',
        ward_code: '200001',
        district_code: '-1',
        first_name: 'CANARY',
      },
    }),
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }
  // Sapo returns 422 with errors[].code === 'unsupported' when locked.
  const stillLocked =
    res.status === 422 &&
    typeof body === 'object' &&
    body !== null &&
    Array.isArray((body as { errors?: unknown[] }).errors);
  return { stillLocked, httpStatus: res.status, body };
}

interface CanaryResult {
  resource: string;
  endpoint: string;
  httpStatus: number;
  parsed: 'ok' | 'fail';
  errorIssues?: z.ZodIssue[];
}

async function main(): Promise<never> {
  const store = process.env.SAPO_STORE;
  const apiKey = process.env.SAPO_API_KEY;
  const apiSecret = process.env.SAPO_API_SECRET;

  if (!store || !apiKey || !apiSecret) {
    log('error', 'Missing required env: SAPO_STORE, SAPO_API_KEY, SAPO_API_SECRET');
    process.exit(1);
  }

  log('info', `Canary check on store: ${store} (creds: ${maskCredentials(apiKey)})`);
  const baseUrl = `https://${store}.mysapo.net`;
  const auth = buildBasicAuthHeader(apiKey, apiSecret);

  const results: CanaryResult[] = [];
  let driftCount = 0;

  // Anchor: store.json (auth canary — 401 here = abort)
  const storeRes = await fetchJson(`${baseUrl}/admin/store.json`, auth);
  if (storeRes.status === 401) {
    log('error', 'Auth failure (401) on /admin/store.json — aborting');
    process.exit(2);
  }
  if (storeRes.status !== 200) {
    log('error', `/admin/store.json returned ${storeRes.status} — aborting`);
    process.exit(1);
  }
  const storeParsed = StoreSingleSchema.safeParse(storeRes.body);
  results.push({
    resource: 'store',
    endpoint: '/admin/store.json',
    httpStatus: 200,
    parsed: storeParsed.success ? 'ok' : 'fail',
    errorIssues: storeParsed.success ? undefined : storeParsed.error.issues,
  });
  if (!storeParsed.success) driftCount++;

  // Schema drift checks
  for (const entry of CANARY_MATRIX) {
    const res = await fetchJson(`${baseUrl}${entry.endpoint}`, auth);
    if (res.status === 401) {
      log('error', `Auth failure on ${entry.endpoint}`);
      process.exit(2);
    }
    if (res.status !== 200) {
      results.push({
        resource: entry.resource,
        endpoint: entry.endpoint,
        httpStatus: res.status,
        parsed: 'fail',
      });
      log('warn', `${entry.resource}: HTTP ${res.status} (was 200 at last verified date)`);
      driftCount++;
      continue;
    }
    const parsed = entry.schema.safeParse(res.body);
    results.push({
      resource: entry.resource,
      endpoint: entry.endpoint,
      httpStatus: 200,
      parsed: parsed.success ? 'ok' : 'fail',
      errorIssues: parsed.success ? undefined : parsed.error.issues,
    });
    if (parsed.success) {
      log('info', `${entry.resource}: ok`);
    } else {
      log('error', `${entry.resource}: SCHEMA DRIFT — ${parsed.error.issues.length} issue(s)`);
      for (const issue of parsed.error.issues.slice(0, 5)) {
        log('error', `  ${issue.path.join('.')}: ${issue.message}`);
      }
      driftCount++;
    }
  }

  // Optional write-lock probe (level=2 write API).
  let writeLockReport: unknown = null;
  if (process.env.CANARY_PROBE_WRITE === '1' && process.env.CANARY_CUSTOMER_ID) {
    const probe = await probeWriteLock(baseUrl, auth, process.env.CANARY_CUSTOMER_ID);
    writeLockReport = probe;
    if (probe.stillLocked) {
      log('info', 'level2_write_lock: still locked (HTTP 422) — expected');
    } else {
      log(
        'error',
        `level2_write_lock: UNLOCKED (HTTP ${probe.httpStatus}) — Sapo may now accept level=2 writes. ` +
          'Action: remove src/tools/address-write-validation.ts and add `level` param to write tools.',
      );
      driftCount++;
    }
  }

  const reportPath = resolve(process.cwd(), 'canary-report.json');
  writeFileSync(
    reportPath,
    JSON.stringify({ store, runAt: new Date().toISOString(), results, writeLockReport }, null, 2),
  );
  log('info', `Report: ${reportPath}`);

  if (driftCount > 0) {
    log('error', `Canary FAILED — ${driftCount} drift(s) detected`);
    process.exit(3);
  }
  log('info', `Canary OK — all ${results.length} schemas validated`);
  process.exit(0);
}

main().catch((err) => {
  log('error', `Fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
