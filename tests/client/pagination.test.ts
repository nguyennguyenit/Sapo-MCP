/**
 * Tests for src/client/pagination.ts
 * Covers: single page, multi-page since_id, MAX_AUTO_PAGES cap, empty response
 */
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SapoClient } from '../../src/client/http.js';
import { paginate, paginateStream } from '../../src/client/pagination.js';

// Mock sleep to avoid delays
vi.mock('../../src/client/sleep.js', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
}));

const TEST_STORE = 'testshop';
const API_BASE = `https://${TEST_STORE}.mysapo.net/admin`;

const mswServer = setupServer();
beforeAll(() => mswServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

function makeClient(): SapoClient {
  return new SapoClient({
    store: TEST_STORE,
    apiKey: 'key',
    apiSecret: 'secret',
  });
}

interface Item {
  id: number;
  name: string;
}

describe('paginate — single page', () => {
  it('returns items from a single page', async () => {
    mswServer.use(
      http.get(`${API_BASE}/products.json`, () =>
        HttpResponse.json({
          products: [
            { id: 1, name: 'A' },
            { id: 2, name: 'B' },
          ],
        }),
      ),
    );

    const client = makeClient();
    const items = await paginate<Item>(client, '/products.json', 'products', {
      pageSize: 250,
      maxPages: 10,
    });
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe(1);
  });

  it('returns empty array when response has no items', async () => {
    mswServer.use(http.get(`${API_BASE}/products.json`, () => HttpResponse.json({ products: [] })));

    const client = makeClient();
    const items = await paginate<Item>(client, '/products.json', 'products');
    expect(items).toEqual([]);
  });
});

describe('paginate — multi-page since_id', () => {
  it('follows since_id across multiple pages', async () => {
    // Page 1: 3 items (page size = 3)
    // Page 2: 3 items
    // Page 3: 1 item (less than page size → last page)
    const allItems: Item[] = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
      { id: 4, name: 'D' },
      { id: 5, name: 'E' },
      { id: 6, name: 'F' },
      { id: 7, name: 'G' },
    ];

    mswServer.use(
      http.get(`${API_BASE}/products.json`, ({ request }) => {
        const url = new URL(request.url);
        const sinceId = url.searchParams.get('since_id');
        const limit = parseInt(url.searchParams.get('limit') ?? '3', 10);

        let startIdx = 0;
        if (sinceId) {
          startIdx = allItems.findIndex((i) => i.id === parseInt(sinceId, 10)) + 1;
        }
        return HttpResponse.json({ products: allItems.slice(startIdx, startIdx + limit) });
      }),
    );

    const client = makeClient();
    const items = await paginate<Item>(client, '/products.json', 'products', {
      pageSize: 3,
      maxPages: 10,
    });
    expect(items).toHaveLength(7);
    expect(items.map((i) => i.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('stops at MAX_AUTO_PAGES cap', async () => {
    // Each page returns pageSize items (never terminates naturally)
    let pageCount = 0;
    mswServer.use(
      http.get(`${API_BASE}/orders.json`, () => {
        pageCount++;
        const base = pageCount * 100;
        return HttpResponse.json({
          orders: [
            { id: base + 1, name: `order-${base + 1}` },
            { id: base + 2, name: `order-${base + 2}` },
          ],
        });
      }),
    );

    const client = makeClient();
    const items = await paginate<Item>(client, '/orders.json', 'orders', {
      pageSize: 2,
      maxPages: 3,
    });
    // maxPages=3: page 0 (initial), page 1, page 2 → stop at page count = maxPages
    expect(pageCount).toBe(3);
    expect(items.length).toBeGreaterThan(0);
  });
});

describe('paginateStream', () => {
  it('yields pages as they come', async () => {
    mswServer.use(
      http.get(`${API_BASE}/customers.json`, ({ request }) => {
        const url = new URL(request.url);
        const sinceId = url.searchParams.get('since_id');
        if (!sinceId) {
          return HttpResponse.json({
            customers: [
              { id: 1, name: 'Alice' },
              { id: 2, name: 'Bob' },
            ],
          });
        }
        return HttpResponse.json({ customers: [] });
      }),
    );

    const client = makeClient();
    const pages: Item[][] = [];
    for await (const page of paginateStream<Item>(client, '/customers.json', 'customers', {
      pageSize: 2,
    })) {
      pages.push(page);
    }
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(2);
  });
});
