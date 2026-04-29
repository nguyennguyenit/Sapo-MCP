/**
 * Shared types for the Sapo HTTP client layer.
 */

export interface SapoClientOptions {
  /** Store subdomain (e.g. "mystorename" → mystorename.mysapo.net) */
  store: string;
  apiKey: string;
  apiSecret: string;
  /** Max retry attempts on 429/5xx (default 3) */
  retryMax?: number;
  /** Request timeout in milliseconds (default 30000) */
  timeoutMs?: number;
}

export interface RequestOptions {
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  signal?: AbortSignal;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/** Raw Sapo API response envelope (resources always wrapped in a key) */
export type SapoApiResponse = Record<string, unknown>;

export interface PaginationParams {
  since_id?: string | number;
  limit?: number;
  [key: string]: string | number | boolean | undefined;
}
