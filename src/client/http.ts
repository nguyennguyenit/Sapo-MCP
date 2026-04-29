/**
 * SapoClient: HTTP client for Sapo Admin API.
 *
 * Features:
 *   - Basic Auth (base64(key:secret))
 *   - Exponential backoff retry: 3x on 429/5xx with Retry-After respect
 *   - AbortSignal timeout support
 *   - URL building: https://{store}.mysapo.net/admin/...
 *   - No retry on 401, 404, 422 (non-transient errors)
 */

import { buildBasicAuthHeader } from './auth.js';
import {
  buildErrorFromResponse,
  SapoAuthError,
  SapoError,
  SapoNotFoundError,
  SapoRateLimitError,
  SapoValidationError,
} from './errors.js';
import { sleep } from './sleep.js';
import type { HttpMethod, RequestOptions, SapoApiResponse, SapoClientOptions } from './types.js';

/** Base delay for exponential backoff (1s). Multiplied by 2^attempt. */
const BACKOFF_BASE_MS = 1000;
/** Default request timeout */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Returns true if error is non-retryable (auth, not found, validation) */
function isNonRetryable(err: unknown): boolean {
  return (
    err instanceof SapoAuthError ||
    err instanceof SapoNotFoundError ||
    err instanceof SapoValidationError
  );
}

export class SapoClient {
  private readonly authHeader: string;
  private readonly baseUrl: string;
  private readonly retryMax: number;
  private readonly timeoutMs: number;

  constructor(opts: SapoClientOptions) {
    this.authHeader = buildBasicAuthHeader(opts.apiKey, opts.apiSecret);
    this.baseUrl = `https://${opts.store}.mysapo.net/admin`;
    this.retryMax = opts.retryMax ?? 3;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Build full URL for an admin endpoint path.
   * Path should start with "/" (e.g. "/orders.json").
   */
  buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) {
          url.searchParams.set(k, String(v));
        }
      }
    }
    return url.toString();
  }

  /**
   * Execute an HTTP request with retry/backoff logic.
   * Throws SapoError on terminal failures.
   */
  async request(
    method: HttpMethod,
    path: string,
    opts: RequestOptions = {},
  ): Promise<SapoApiResponse> {
    const url = this.buildUrl(path, opts.params);
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const bodyStr = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
    let attempt = 0;

    while (true) {
      const controller = new AbortController();
      let timedOut = false;
      const timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, this.timeoutMs);

      // Link caller's signal to our controller; track caller-initiated aborts separately
      const callerSignal = opts.signal;
      const onCallerAbort = (): void => controller.abort();
      if (callerSignal) {
        if (callerSignal.aborted) {
          clearTimeout(timeoutId);
          throw new Error('Request aborted by caller');
        }
        callerSignal.addEventListener('abort', onCallerAbort, { once: true });
      }

      try {
        const response = await fetch(url, {
          method,
          headers,
          body: bodyStr,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        callerSignal?.removeEventListener('abort', onCallerAbort);

        if (response.ok) {
          // 204 No Content
          if (response.status === 204) return {};
          return (await response.json()) as SapoApiResponse;
        }

        const err = await buildErrorFromResponse(response);

        // Non-retryable errors: throw immediately
        if (isNonRetryable(err)) throw err;

        // Rate limit: respect Retry-After header
        if (err instanceof SapoRateLimitError) {
          if (attempt >= this.retryMax) throw err;
          await sleep(err.retryAfterMs);
          attempt++;
          continue;
        }

        // 5xx server errors: exponential backoff
        if (attempt >= this.retryMax) throw err;
        const backoffMs = BACKOFF_BASE_MS * 2 ** attempt;
        await sleep(backoffMs);
        attempt++;
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        callerSignal?.removeEventListener('abort', onCallerAbort);

        // Caller-initiated cancellation: propagate immediately, no retry
        if (callerSignal?.aborted && !timedOut) throw fetchErr;

        // SapoErrors are terminal — propagate (non-retryable already thrown above)
        if (fetchErr instanceof SapoError) throw fetchErr;

        // Timeout/network error: retry with backoff
        if (attempt >= this.retryMax) throw fetchErr;
        const backoffMs = BACKOFF_BASE_MS * 2 ** attempt;
        await sleep(backoffMs);
        attempt++;
      }
    }
  }

  get<T extends SapoApiResponse>(path: string, opts?: RequestOptions): Promise<T> {
    return this.request('GET', path, opts) as Promise<T>;
  }

  post<T extends SapoApiResponse>(path: string, body: unknown, opts?: RequestOptions): Promise<T> {
    return this.request('POST', path, { ...opts, body }) as Promise<T>;
  }

  put<T extends SapoApiResponse>(path: string, body: unknown, opts?: RequestOptions): Promise<T> {
    return this.request('PUT', path, { ...opts, body }) as Promise<T>;
  }

  delete<T extends SapoApiResponse>(path: string, opts?: RequestOptions): Promise<T> {
    return this.request('DELETE', path, opts) as Promise<T>;
  }
}
