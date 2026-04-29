/**
 * since_id auto-paginator for Sapo Admin API.
 *
 * Sapo uses since_id cursor pagination: each page returns items with
 * ID > since_id. We collect all pages up to MAX_AUTO_PAGES cap.
 *
 * Usage:
 *   const items = await paginate(client, '/orders.json', 'orders', { status: 'open' });
 */

import type { SapoClient } from './http.js';
import type { PaginationParams } from './types.js';

export interface PaginateOptions {
  /** Max items per page (Sapo max: 250) */
  pageSize?: number;
  /** Cap auto-pagination at N pages (default: from config via caller) */
  maxPages?: number;
  /** Additional query params (merged with pagination params) */
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Auto-paginate a Sapo list endpoint using since_id cursor strategy.
 * Collects all results up to maxPages * pageSize items.
 *
 * @param client   SapoClient instance
 * @param path     API path (e.g. "/orders.json")
 * @param key      Response envelope key (e.g. "orders")
 * @param options  Pagination options
 * @returns        Flat array of all collected items
 */
export async function paginate<T>(
  client: SapoClient,
  path: string,
  key: string,
  options: PaginateOptions = {},
): Promise<T[]> {
  const pageSize = options.pageSize ?? 250;
  const maxPages = options.maxPages ?? 10;
  const extraParams = options.params ?? {};

  const results: T[] = [];
  let sinceId: string | number | undefined;
  let page = 0;

  while (page < maxPages) {
    const params: PaginationParams = {
      ...extraParams,
      limit: pageSize,
    };
    if (sinceId !== undefined) {
      params.since_id = sinceId;
    }

    const response = await client.get(path, { params });
    const items = (response[key] ?? []) as T[];

    if (items.length === 0) break;

    results.push(...items);

    // Sapo since_id: next page starts after last item's id
    const lastItem = items[items.length - 1] as Record<string, unknown>;
    const lastId = lastItem?.id;

    if (lastId === undefined || items.length < pageSize) {
      // No more pages
      break;
    }

    sinceId = lastId as string | number;
    page++;
  }

  return results;
}

/**
 * Async generator variant for memory-efficient streaming of large datasets.
 * Yields one page at a time.
 */
export async function* paginateStream<T>(
  client: SapoClient,
  path: string,
  key: string,
  options: PaginateOptions = {},
): AsyncGenerator<T[]> {
  const pageSize = options.pageSize ?? 250;
  const maxPages = options.maxPages ?? 10;
  const extraParams = options.params ?? {};

  let sinceId: string | number | undefined;
  let page = 0;

  while (page < maxPages) {
    const params: PaginationParams = {
      ...extraParams,
      limit: pageSize,
    };
    if (sinceId !== undefined) {
      params.since_id = sinceId;
    }

    const response = await client.get(path, { params });
    const items = (response[key] ?? []) as T[];

    if (items.length === 0) break;

    yield items;

    const lastItem = items[items.length - 1] as Record<string, unknown>;
    const lastId = lastItem?.id;

    if (lastId === undefined || items.length < pageSize) break;

    sinceId = lastId as string | number;
    page++;
  }
}
