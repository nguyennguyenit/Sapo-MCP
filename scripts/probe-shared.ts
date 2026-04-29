/**
 * Shared utilities for probe scripts.
 * - Store-name guard (write-probe production safety)
 * - Basic auth header builder
 * - Credential masker for log output
 * - Simple stderr logger
 * - Fetch wrapper with 5s timeout + 1 retry
 */

/** Regex to identify non-production store names (write-probe safety gate). */
const SAFE_STORE_PATTERN = /test|dev|sandbox/i;

/**
 * Assert the store name is safe for write operations.
 * Throws if the store name looks like a production store.
 *
 * CRITICAL: Write-probe MUST NOT run against production stores.
 * This guard is the last line of defence before any mutating request.
 */
export function assertWriteSafeStore(storeName: string): void {
  if (!SAFE_STORE_PATTERN.test(storeName)) {
    throw new Error(
      `WRITE-PROBE REFUSED: Store "${storeName}" appears to be a production store. ` +
        `Write-probe only runs against stores whose name contains "test", "dev", or "sandbox". ` +
        `Set SAPO_STORE to a non-production store to enable write-probe.`,
    );
  }
}

/**
 * Build the HTTP Basic Authorization header value.
 * Format: "Basic <base64(apiKey:apiSecret)>"
 */
export function buildBasicAuthHeader(apiKey: string, apiSecret: string): string {
  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  return `Basic ${credentials}`;
}

/**
 * Replace raw credential values in a string with "***".
 * Use before logging any error messages that may include credential data.
 */
export function maskCredentials(text: string, apiKey: string, apiSecret: string): string {
  let masked = text;
  if (apiKey) {
    masked = masked.replaceAll(apiKey, '***');
  }
  if (apiSecret) {
    masked = masked.replaceAll(apiSecret, '***');
  }
  return masked;
}

/** Log levels for the probe logger. */
type LogLevel = 'info' | 'warn' | 'error';

/**
 * Simple stderr logger. Never logs to stdout to keep JSON output clean.
 * Credentials are NOT automatically masked here — callers must use maskCredentials first.
 */
export function log(level: LogLevel, message: string): void {
  const prefix = `[probe:${level}]`;
  process.stderr.write(`${prefix} ${message}\n`);
}

/** Options for the retrying fetch wrapper. */
export interface FetchOptions {
  url: string;
  headers: Record<string, string>;
  timeoutMs?: number;
}

export interface FetchResult {
  status: number;
  ok: boolean;
  /** Whether the error was an AbortError (timeout). */
  timedOut?: boolean;
  /** Non-auth network or server error. */
  networkError?: string;
}

/**
 * Fetch a URL with a timeout and single retry on network error or 5xx.
 * Does NOT retry on 4xx (client errors are definitive).
 * Returns a FetchResult — never throws.
 */
export async function fetchWithRetry(opts: FetchOptions): Promise<FetchResult> {
  const { url, headers, timeoutMs = 5000 } = opts;

  async function attempt(): Promise<FetchResult> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      return { status: response.status, ok: response.ok };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { status: 0, ok: false, timedOut: true };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return { status: 0, ok: false, networkError: msg };
    }
  }

  const first = await attempt();

  // Retry once on network error or 5xx; never retry timeouts or 4xx
  const shouldRetry = !first.timedOut && (first.networkError !== undefined || first.status >= 500);

  if (shouldRetry) {
    return attempt();
  }

  return first;
}
