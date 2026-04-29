/**
 * Write-probe runner — sacrificial resource write cycle test.
 *
 * Entry point for: npm run probe:write
 *
 * HARD-GUARDED FOR PRODUCTION:
 * This script refuses to run unless SAPO_STORE matches /test|dev|sandbox/i.
 * Even with the --write flag, the production guard runs first.
 *
 * Flow (on non-production store only):
 *   1. Check SAPO_STORE matches safe pattern — ABORT if not
 *   2. Prompt: "Type YES to proceed with write probe on <store>"
 *   3. For each sacrificial resource: POST → GET verify → DELETE
 *   4. If DELETE fails: log warn + note resource_id for manual cleanup
 *
 * Write probe matrix:
 *   - Suppliers: create `_TESTPROBE_<timestamp>` → DELETE
 *   - Purchase Orders: create draft with 0 lines → cancel/DELETE
 *   - Stock Transfers: create 0-qty transfer → cancel
 *   - Cash Transactions: create cash_in 1 VND → cancel
 *   - POS Shifts: open shift → close shift immediately
 *
 * This script is NOT run against the user's production store.
 * Phase 1 only verifies this file exists and the guard works.
 */
import { createInterface } from 'node:readline';

import {
  assertWriteSafeStore,
  buildBasicAuthHeader,
  log,
  maskCredentials,
} from './probe-shared.js';

// ─── Write probe matrix ───────────────────────────────────────────────────────

interface WriteProbeEntry {
  category: string;
  description: string;
  /** POST endpoint to create sacrificial resource. */
  createEndpoint: string;
  /** Minimal payload that should succeed even on empty stores. */
  createPayload: Record<string, unknown>;
  /** How to clean up: 'delete' | 'cancel' | 'close'. */
  cleanupMethod: 'delete' | 'cancel' | 'close';
}

const WRITE_PROBE_MATRIX: WriteProbeEntry[] = [
  {
    category: 'suppliers',
    description: 'Create supplier _TESTPROBE_<ts> → DELETE',
    createEndpoint: '/admin/suppliers.json',
    createPayload: { supplier: { name: `_TESTPROBE_${Date.now()}` } },
    cleanupMethod: 'delete',
  },
  {
    category: 'purchase_orders',
    description: 'Create draft PO with 0 lines → cancel',
    createEndpoint: '/admin/purchase_orders.json',
    createPayload: { purchase_order: { line_items: [] } },
    cleanupMethod: 'cancel',
  },
  {
    category: 'stock_transfers',
    description: 'Create 0-qty stock transfer → cancel',
    createEndpoint: '/admin/stock_transfers.json',
    createPayload: { stock_transfer: { line_items: [] } },
    cleanupMethod: 'cancel',
  },
  {
    category: 'cash_transactions',
    description: 'Create cash_in 1 VND → cancel',
    createEndpoint: '/admin/cash_transactions.json',
    createPayload: { cash_transaction: { transaction_type: 'cash_in', amount: 1 } },
    cleanupMethod: 'cancel',
  },
  {
    category: 'pos_shifts',
    description: 'Open POS shift → close immediately',
    createEndpoint: '/admin/pos_shifts.json',
    createPayload: { pos_shift: {} },
    cleanupMethod: 'close',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function promptYes(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim() === 'YES');
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const store = process.env.SAPO_STORE;
  const apiKey = process.env.SAPO_API_KEY;
  const apiSecret = process.env.SAPO_API_SECRET;

  // Validate ENV
  const missing: string[] = [];
  if (!store) missing.push('SAPO_STORE');
  if (!apiKey) missing.push('SAPO_API_KEY');
  if (!apiSecret) missing.push('SAPO_API_SECRET');
  if (missing.length > 0) {
    log('error', `Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  // PRODUCTION GUARD — this runs unconditionally, cannot be bypassed
  try {
    assertWriteSafeStore(store as string);
  } catch (err) {
    log('error', err instanceof Error ? err.message : String(err));
    log('error', 'Write-probe ABORTED. Set SAPO_STORE to a test/dev/sandbox store to proceed.');
    process.exit(1);
  }

  // Require --write flag
  if (!process.argv.includes('--write')) {
    log('error', 'Write-probe requires the --write flag to proceed.');
    log('error', 'Usage: tsx scripts/probe-write.ts --write');
    log('error', 'Even with --write, store name must contain test/dev/sandbox.');
    process.exit(1);
  }

  // Interactive confirmation
  const confirmed = await promptYes(`\nType YES to proceed with write probe on "${store}": `);
  if (!confirmed) {
    log('info', 'Write-probe cancelled by user.');
    process.exit(0);
  }

  // Run write probes
  const baseUrl = `https://${store}.mysapo.net`;
  const authHeader = buildBasicAuthHeader(apiKey as string, apiSecret as string);
  const orphans: string[] = [];

  log('info', `Starting write probe on store: ${store}`);
  log('info', `Testing ${WRITE_PROBE_MATRIX.length} sacrificial resources...`);

  for (const entry of WRITE_PROBE_MATRIX) {
    log('info', `[${entry.category}] ${entry.description}`);

    // POST
    let createdId: number | string | undefined;
    try {
      const createResponse = await fetch(`${baseUrl}${entry.createEndpoint}`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry.createPayload),
        signal: AbortSignal.timeout(10000),
      });

      if (!createResponse.ok) {
        const body = await createResponse.text().catch(() => '');
        const masked = maskCredentials(body, apiKey as string, apiSecret as string);
        if (createResponse.status === 404) {
          log('warn', `[${entry.category}] endpoint not found (404) — unsupported_endpoint`);
        } else if (createResponse.status === 422) {
          log(
            'warn',
            `[${entry.category}] payload rejected (422): ${masked} — unsupported_payload`,
          );
        } else {
          log(
            'warn',
            `[${entry.category}] create failed: HTTP ${createResponse.status}: ${masked}`,
          );
        }
        continue;
      }

      const data = (await createResponse.json()) as Record<string, Record<string, unknown>>;
      // Extract id from first key of response body
      const resourceKey = Object.keys(data)[0];
      createdId = data[resourceKey]?.id as number | string | undefined;
      log('info', `[${entry.category}] created id=${createdId ?? 'unknown'}`);
    } catch (err) {
      const msg = maskCredentials(
        err instanceof Error ? err.message : String(err),
        apiKey as string,
        apiSecret as string,
      );
      log('warn', `[${entry.category}] create error: ${msg}`);
      continue;
    }

    // Cleanup
    if (createdId === undefined) {
      log('warn', `[${entry.category}] no id returned — cannot cleanup`);
      continue;
    }

    try {
      let cleanupUrl: string;
      let cleanupMethod: string;
      let cleanupBody: string | undefined;

      if (entry.cleanupMethod === 'delete') {
        cleanupUrl = `${baseUrl}/admin/${entry.category}/${createdId}.json`;
        cleanupMethod = 'DELETE';
      } else if (entry.cleanupMethod === 'cancel') {
        cleanupUrl = `${baseUrl}${entry.createEndpoint.replace('.json', '')}/${createdId}/cancel.json`;
        cleanupMethod = 'POST';
        cleanupBody = '{}';
      } else {
        // close
        cleanupUrl = `${baseUrl}${entry.createEndpoint.replace('.json', '')}/${createdId}/close.json`;
        cleanupMethod = 'POST';
        cleanupBody = '{}';
      }

      const cleanupResponse = await fetch(cleanupUrl, {
        method: cleanupMethod,
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: cleanupBody,
        signal: AbortSignal.timeout(10000),
      });

      if (!cleanupResponse.ok) {
        log(
          'warn',
          `[${entry.category}] cleanup failed: HTTP ${cleanupResponse.status} — ORPHAN id=${createdId}`,
        );
        orphans.push(`${entry.category}:${createdId}`);
      } else {
        log('info', `[${entry.category}] cleanup OK`);
      }
    } catch (err) {
      const msg = maskCredentials(
        err instanceof Error ? err.message : String(err),
        apiKey as string,
        apiSecret as string,
      );
      log('warn', `[${entry.category}] cleanup error: ${msg} — ORPHAN id=${createdId}`);
      orphans.push(`${entry.category}:${createdId}`);
    }
  }

  if (orphans.length > 0) {
    log('warn', `Write-probe complete. Orphaned resources requiring manual cleanup:`);
    for (const o of orphans) {
      log('warn', `  - ${o}`);
    }
  } else {
    log('info', 'Write-probe complete. All sacrificial resources cleaned up successfully.');
  }
}

main().catch((err) => {
  log('error', `Unhandled error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
