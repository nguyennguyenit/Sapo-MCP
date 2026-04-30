/**
 * Read-probe runner — Phase 1 API verification.
 *
 * Entry point for: npm run probe
 *
 * Probes all endpoints in PROBE_MATRIX with GET requests (read-only).
 * Writes structured JSON + human-readable markdown report.
 *
 * Exit codes:
 *   0 = all available (no regression)
 *   2 = auth failure (credentials invalid)
 *   3 = some endpoints regressed / not all smoke tests passed
 *   1 = fatal error (missing ENV, unexpected crash)
 *
 * PRODUCTION SAFE: This script is GET-only. No mutations occur.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProbeBucket, ProbeEntry } from './probe-matrix.js';
import { PROBE_MATRIX } from './probe-matrix.js';
import { buildBasicAuthHeader, fetchWithRetry, log, maskCredentials } from './probe-shared.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProbeStatus =
  | 'available'
  | 'not_found'
  | 'auth_failed'
  | 'forbidden'
  | 'error'
  | 'timeout';

export interface ProbeResult {
  resource: string;
  endpoint: string;
  status: ProbeStatus;
  bucket: ProbeBucket;
  httpStatus: number;
  durationMs: number;
  errorMessage?: string;
}

interface ProbeEnv {
  SAPO_STORE: string;
  SAPO_API_KEY: string;
  SAPO_API_SECRET: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Map HTTP status code to a ProbeStatus category.
 */
export function categorizeStatus(httpStatus: number): ProbeStatus {
  if (httpStatus >= 200 && httpStatus < 300) return 'available';
  // 401 = bad creds (early-exit). 403 = endpoint-specific permission (continue probing).
  if (httpStatus === 401) return 'auth_failed';
  if (httpStatus === 403) return 'forbidden';
  if (httpStatus === 404) return 'not_found';
  return 'error';
}

/**
 * Parse and validate required probe ENV vars.
 * Throws with a descriptive message on missing values.
 */
function parseProbeEnv(env: NodeJS.ProcessEnv | Record<string, string | undefined>): ProbeEnv {
  const store = env.SAPO_STORE;
  const apiKey = env.SAPO_API_KEY;
  const apiSecret = env.SAPO_API_SECRET;

  const missing: string[] = [];
  if (!store) missing.push('SAPO_STORE');
  if (!apiKey) missing.push('SAPO_API_KEY');
  if (!apiSecret) missing.push('SAPO_API_SECRET');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        'Copy .env.example, fill in credentials, and re-run: npm run probe',
    );
  }

  return {
    SAPO_STORE: store as string,
    SAPO_API_KEY: apiKey as string,
    SAPO_API_SECRET: apiSecret as string,
  };
}

// ─── Core runner ──────────────────────────────────────────────────────────────

/**
 * Probe a single endpoint. Returns a ProbeResult.
 * Never throws — all errors are captured in the result.
 */
async function probeOne(
  entry: ProbeEntry,
  baseUrl: string,
  authHeader: string,
  apiKey: string,
  apiSecret: string,
): Promise<ProbeResult> {
  const url = `${baseUrl}${entry.endpoint}`;
  const start = Date.now();

  const fetchResult = await fetchWithRetry({
    url,
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    timeoutMs: 5000,
  });

  const durationMs = Date.now() - start;

  if (fetchResult.timedOut) {
    return {
      resource: entry.resource,
      endpoint: entry.endpoint,
      status: 'timeout',
      bucket: entry.bucket,
      httpStatus: 0,
      durationMs,
    };
  }

  if (fetchResult.networkError !== undefined) {
    const masked = maskCredentials(fetchResult.networkError, apiKey, apiSecret);
    return {
      resource: entry.resource,
      endpoint: entry.endpoint,
      status: 'error',
      bucket: entry.bucket,
      httpStatus: 0,
      durationMs,
      errorMessage: masked,
    };
  }

  const status = categorizeStatus(fetchResult.status);
  return {
    resource: entry.resource,
    endpoint: entry.endpoint,
    status,
    bucket: entry.bucket,
    httpStatus: fetchResult.status,
    durationMs,
  };
}

/**
 * Run the full probe matrix with concurrency=4.
 * Short-circuits on auth failure (401/403 on first response).
 *
 * When a batch returns an auth failure, we stop processing further batches.
 * The first auth-failed result is included; subsequent entries are skipped.
 *
 * Exported for testing — accepts env map and optional custom matrix.
 */
export async function runProbe(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  matrix: ProbeEntry[] = PROBE_MATRIX,
): Promise<ProbeResult[]> {
  const { SAPO_STORE, SAPO_API_KEY, SAPO_API_SECRET } = parseProbeEnv(env);
  const baseUrl = `https://${SAPO_STORE}.mysapo.net`;
  const authHeader = buildBasicAuthHeader(SAPO_API_KEY, SAPO_API_SECRET);

  const results: ProbeResult[] = [];
  const CONCURRENCY = 4;

  // Process matrix in batches of CONCURRENCY
  for (let i = 0; i < matrix.length; i += CONCURRENCY) {
    const batch = matrix.slice(i, i + CONCURRENCY);

    // Use sequential race within batch: probe each entry and stop the batch
    // as soon as auth failure is detected to ensure early exit even within a batch.
    let authFailed = false;
    for (const entry of batch) {
      const r = await probeOne(entry, baseUrl, authHeader, SAPO_API_KEY, SAPO_API_SECRET);
      results.push(r);

      if (r.status === 'auth_failed') {
        authFailed = true;
        break; // Stop processing remaining entries in this batch
      }
    }

    // Short-circuit: auth failure means all remaining batches will also fail
    if (authFailed) {
      log('error', 'Auth failure detected — aborting remaining probes');
      break;
    }
  }

  return results;
}

// ─── Report generation ────────────────────────────────────────────────────────

const STATUS_EMOJI: Record<ProbeStatus, string> = {
  available: 'OK',
  not_found: 'NOT FOUND',
  auth_failed: 'AUTH FAIL',
  forbidden: 'FORBIDDEN',
  error: 'ERROR',
  timeout: 'TIMEOUT',
};

/**
 * Determine G1 scope recommendation based on Bucket B available count.
 */
function g1Recommendation(availableCount: number): string {
  if (availableCount >= 5) return 'full — implement pos-counter with all resources';
  if (availableCount >= 2) return 'partial — implement pos-counter with available resources only';
  return 'defer — insufficient POS API surface; pos-counter scope not viable';
}

/**
 * Generate human-readable markdown report from probe results.
 * Exported for testing.
 */
export function generateMarkdownReport(results: ProbeResult[], date: Date): string {
  const dateStr = date.toISOString().split('T')[0];

  const bucketA = results.filter((r) => r.bucket === 'A');
  const bucketB = results.filter((r) => r.bucket === 'B');
  const bucketBAvailable = bucketB.filter((r) => r.status === 'available');

  // NOTE: errorMessage in ProbeResult should already be masked by probeOne.
  // For report safety, we strip errorMessage from the table entirely — it's
  // available in probe-results.json for debugging.
  const tableRow = (r: ProbeResult) =>
    `| ${r.resource} | \`${r.endpoint}\` | ${STATUS_EMOJI[r.status]} | ${r.httpStatus || '-'} | ${r.durationMs}ms |`;

  const tableHeader = `| Resource | Endpoint | Status | HTTP | Duration |
|----------|----------|--------|------|----------|`;

  const bucketATable =
    bucketA.length > 0
      ? `${tableHeader}\n${bucketA.map(tableRow).join('\n')}`
      : '_No Bucket A results_';

  const bucketBTable =
    bucketB.length > 0
      ? `${tableHeader}\n${bucketB.map(tableRow).join('\n')}`
      : '_No Bucket B results_';

  const g1 = g1Recommendation(bucketBAvailable.length);
  const authFailed = results.some((r) => r.status === 'auth_failed');

  return `# Sapo API Verification Report

> Generated by \`npm run probe\` on ${dateStr}
> **PRODUCTION SAFE:** This report was generated by read-only GET probes. No data was modified.

---

## Bucket A — Smoke Test (confirmed Sapo Admin API)

${bucketATable}

**Bucket A summary:** ${bucketA.filter((r) => r.status === 'available').length}/${bucketA.length} available

---

## Bucket B — POS Endpoint Verification (uncertain)

${bucketBTable}

**Bucket B summary:** ${bucketBAvailable.length}/${bucketB.length} available
${authFailed ? '\n> WARNING: Auth failure detected. Results may be incomplete.\n' : ''}
---

## Decision Gate Recommendations

### G1 — Phase 6 Scope (pos-counter)

- **Bucket B available:** ${bucketBAvailable.length}
- **Recommendation:** ${g1}

### G2 — Write Probe Outcome

- **Result:** Skipped — production store (write-probe requires test/dev/sandbox store name)
- **Note:** Run \`npm run probe:write\` on a non-production store to assess write capability.

---

## Notes

- Endpoints with status NOT FOUND (404) are not available in this store's API
- Endpoints with status AUTH FAIL (401) — credentials invalid for the entire API
- Endpoints with status FORBIDDEN (403) — endpoint-specific permission denied; Private App may need scope upgrade or this resource is paywalled
- Flaky endpoints (TIMEOUT/ERROR) should be re-probed before making scope decisions
- See \`decision-gates.md\` for G1/G2 criteria and Phase 6 decision

---

_Generated by sapo-mcp probe-read.ts — https://github.com/nguyennguyenit/Sapo-MCP_
`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const reportsDir = resolve(__dirname, '../plans/260430-1000-sapo-mcp-implementation');

  let probeEnv: ProbeEnv;
  try {
    probeEnv = parseProbeEnv(process.env);
  } catch (err) {
    log('error', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  log('info', `Starting read probe for store: ${probeEnv.SAPO_STORE}`);
  log('info', `Probing ${PROBE_MATRIX.length} endpoints with concurrency=4...`);

  let results: ProbeResult[];
  try {
    results = await runProbe(process.env);
  } catch (err) {
    const msg = maskCredentials(
      err instanceof Error ? err.message : String(err),
      probeEnv.SAPO_API_KEY,
      probeEnv.SAPO_API_SECRET,
    );
    log('error', `Probe failed: ${msg}`);
    process.exit(1);
  }

  // ─── Write outputs ─────────────────────────────────────────────────────────

  try {
    await mkdir(reportsDir, { recursive: true });

    const jsonPath = resolve(reportsDir, 'probe-results.json');
    await writeFile(jsonPath, JSON.stringify(results, null, 2), 'utf-8');
    log('info', `Results written to: ${jsonPath}`);

    const reportPath = resolve(reportsDir, 'verify-report.md');
    const report = generateMarkdownReport(results, new Date());
    await writeFile(reportPath, report, 'utf-8');
    log('info', `Report written to: ${reportPath}`);
  } catch (err) {
    log(
      'error',
      `Failed to write output files: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  // ─── Exit code ─────────────────────────────────────────────────────────────

  const authFailed = results.some((r) => r.status === 'auth_failed');
  if (authFailed) {
    log('error', 'Authentication failed. Check SAPO_API_KEY and SAPO_API_SECRET.');
    process.exit(2);
  }

  const smokeA = results.filter((r) => r.bucket === 'A');
  const smokeAFailed = smokeA.filter((r) => r.status !== 'available');
  if (smokeAFailed.length > 0) {
    log('warn', `${smokeAFailed.length} Bucket A smoke tests failed — possible regression`);
    process.exit(3);
  }

  log('info', 'Probe complete. All Bucket A smoke tests passed.');
  process.exit(0);
}

// Run main only when invoked directly (not when imported by tests)
const isDirectRun =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url).endsWith(process.argv[1]?.split('/').pop() ?? '');

if (isDirectRun) {
  main();
}
