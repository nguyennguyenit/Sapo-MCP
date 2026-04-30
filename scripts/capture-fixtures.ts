/**
 * Capture live API fixtures for undocumented Sapo endpoints.
 *
 * Usage:
 *   npm run capture:fixtures
 *   npm run capture:fixtures -- --resources=suppliers,pos_shifts
 *
 * Saves to: tests/fixtures/sapo/<resource>/{list,single}.json
 * Masks PII fields recursively before saving.
 *
 * Requires: SAPO_STORE, SAPO_API_KEY, SAPO_API_SECRET in env.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildBasicAuthHeader, log } from './probe-shared.js';

// `name` intentionally excluded: payment_methods/locations/suppliers `name` is
// public business label, not PII. first_name/last_name still masked for people.
const PII_FIELDS = new Set([
  'phone',
  'email',
  'first_name',
  'last_name',
  'address',
  'address1',
  'address2',
  'national_id',
  'dob',
]);

/** Recursively mask PII fields in an object/array. */
function maskPii(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(maskPii);
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = PII_FIELDS.has(k) ? '***' : maskPii(v);
    }
    return result;
  }
  return value;
}

/** Print top-level key types from parsed response. */
function printSchema(label: string, data: unknown): void {
  if (data === null || typeof data !== 'object') return;
  const obj = data as Record<string, unknown>;
  const keys = Object.entries(obj).map(([k, v]) => {
    const t = Array.isArray(v) ? `Array(${(v as unknown[]).length})` : typeof v;
    return `  ${k}: ${t}`;
  });
  log('info', `${label} schema:\n${keys.join('\n')}`);
}

interface ResourceConfig {
  endpoint: string;
  listKey: string;
}

const RESOURCE_MAP: Record<string, ResourceConfig> = {
  suppliers: { endpoint: '/admin/suppliers.json?limit=3', listKey: 'suppliers' },
  pos_shifts: { endpoint: '/admin/pos_shifts.json?limit=3', listKey: 'pos_shifts' },
  stock_transfers: { endpoint: '/admin/stock_transfers.json?limit=3', listKey: 'stock_transfers' },
  payment_methods: { endpoint: '/admin/payment_methods.json', listKey: 'payment_methods' },
  locations: { endpoint: '/admin/locations.json', listKey: 'locations' },
};

async function captureResource(
  storeName: string,
  authHeader: string,
  resourceName: string,
  config: ResourceConfig,
  fixturesRoot: string,
): Promise<void> {
  const url = `https://${storeName}.mysapo.net${config.endpoint}`;
  log('info', `Fetching ${resourceName} from ${url}`);

  const res = await fetch(url, {
    headers: { Authorization: authHeader, Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    log('error', `${resourceName}: HTTP ${res.status}`);
    return;
  }

  const raw = await res.json();
  const masked = maskPii(raw) as Record<string, unknown>;

  const listData = masked[config.listKey] as unknown[];
  if (!Array.isArray(listData)) {
    log('error', `${resourceName}: expected key "${config.listKey}" not found in response`);
    return;
  }

  printSchema(`${resourceName} list-item`, listData[0] ?? {});

  const dir = join(fixturesRoot, resourceName.replaceAll('_', '-'));
  mkdirSync(dir, { recursive: true });

  writeFileSync(join(dir, 'list.json'), JSON.stringify(masked, null, 2));
  log('info', `Saved ${resourceName} list fixture (${listData.length} items)`);

  if (listData.length > 0) {
    const firstItem = listData[0] as Record<string, unknown>;
    const singleKey = config.listKey.replace(/s$/, ''); // naive singularize
    const singleWrapper = { [singleKey]: firstItem };
    writeFileSync(join(dir, 'single.json'), JSON.stringify(singleWrapper, null, 2));
    log('info', `Saved ${resourceName} single fixture (id=${firstItem.id})`);
  }
}

async function main(): Promise<void> {
  const storeName = process.env.SAPO_STORE;
  const apiKey = process.env.SAPO_API_KEY;
  const apiSecret = process.env.SAPO_API_SECRET;

  if (!storeName || !apiKey || !apiSecret) {
    log('error', 'Missing required env: SAPO_STORE, SAPO_API_KEY, SAPO_API_SECRET');
    process.exit(1);
  }

  const authHeader = buildBasicAuthHeader(apiKey, apiSecret);
  const fixturesRoot = join(process.cwd(), 'tests', 'fixtures', 'sapo');

  // Parse --resources= CLI arg
  const resourcesArg = process.argv.find((a) => a.startsWith('--resources='));
  const requestedResources = resourcesArg
    ? resourcesArg.replace('--resources=', '').split(',')
    : Object.keys(RESOURCE_MAP);

  for (const name of requestedResources) {
    const config = RESOURCE_MAP[name];
    if (!config) {
      log('warn', `Unknown resource: ${name}. Available: ${Object.keys(RESOURCE_MAP).join(', ')}`);
      continue;
    }
    await captureResource(storeName, authHeader, name, config, fixturesRoot);
  }

  log('info', 'Capture complete. Review and commit updated fixtures.');
}

main().catch((err) => {
  log('error', String(err));
  process.exit(1);
});
