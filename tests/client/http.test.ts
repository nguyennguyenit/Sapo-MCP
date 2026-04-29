/**
 * Tests for src/client/http.ts — SapoClient
 * Uses MSW v2 for HTTP mocking.
 * Covers: GET success, error types, retry/backoff, timeout, URL building
 */
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  SapoAuthError,
  SapoNotFoundError,
  SapoRateLimitError,
  SapoServerError,
  SapoValidationError,
} from '../../src/client/errors.js';
import { SapoClient } from '../../src/client/http.js';

// Mock sleep to avoid real delays in tests
vi.mock('../../src/client/sleep.js', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
}));

// Import after mock so we can assert on the spy
const { sleep } = await import('../../src/client/sleep.js');

const TEST_STORE = 'testshop';
const API_BASE = `https://${TEST_STORE}.mysapo.net/admin`;

const mswServer = setupServer();

beforeAll(() => mswServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  mswServer.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => mswServer.close());

function makeClient(retryMax = 1): SapoClient {
  return new SapoClient({
    store: TEST_STORE,
    apiKey: 'test-key',
    apiSecret: 'test-secret',
    retryMax,
    timeoutMs: 5000,
  });
}

describe('SapoClient URL building', () => {
  it('builds correct base URL for store', () => {
    const client = makeClient();
    const url = client.buildUrl('/orders.json');
    expect(url).toBe(`${API_BASE}/orders.json`);
  });

  it('appends query params', () => {
    const client = makeClient();
    const url = client.buildUrl('/orders.json', { status: 'open', limit: 50 });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('status')).toBe('open');
    expect(parsed.searchParams.get('limit')).toBe('50');
  });

  it('omits undefined params', () => {
    const client = makeClient();
    const url = client.buildUrl('/orders.json', { status: undefined, limit: 10 });
    const parsed = new URL(url);
    expect(parsed.searchParams.has('status')).toBe(false);
    expect(parsed.searchParams.get('limit')).toBe('10');
  });
});

describe('SapoClient GET success', () => {
  it('returns parsed JSON on 200', async () => {
    mswServer.use(
      http.get(`${API_BASE}/orders.json`, () =>
        HttpResponse.json({ orders: [{ id: 1, status: 'open' }] }),
      ),
    );

    const client = makeClient();
    const result = await client.get('/orders.json');
    expect(result).toEqual({ orders: [{ id: 1, status: 'open' }] });
  });

  it('returns empty object on 204 No Content', async () => {
    mswServer.use(http.get(`${API_BASE}/ping.json`, () => new HttpResponse(null, { status: 204 })));

    const client = makeClient();
    const result = await client.get('/ping.json');
    expect(result).toEqual({});
  });
});

describe('SapoClient error handling', () => {
  it('throws SapoAuthError on 401 without retry', async () => {
    let callCount = 0;
    mswServer.use(
      http.get(`${API_BASE}/orders.json`, () => {
        callCount++;
        return new HttpResponse('Unauthorized', { status: 401 });
      }),
    );

    const client = makeClient(3);
    await expect(client.get('/orders.json')).rejects.toThrow(SapoAuthError);
    expect(callCount).toBe(1); // No retry
  });

  it('throws SapoNotFoundError on 404 without retry', async () => {
    let callCount = 0;
    mswServer.use(
      http.get(`${API_BASE}/orders/999.json`, () => {
        callCount++;
        return new HttpResponse('Not Found', { status: 404 });
      }),
    );

    const client = makeClient(3);
    await expect(client.get('/orders/999.json')).rejects.toThrow(SapoNotFoundError);
    expect(callCount).toBe(1);
  });

  it('throws SapoValidationError on 422 without retry', async () => {
    mswServer.use(
      http.get(`${API_BASE}/orders.json`, () =>
        HttpResponse.json({ errors: { status: 'is invalid' } }, { status: 422 }),
      ),
    );

    const client = makeClient(3);
    await expect(client.get('/orders.json')).rejects.toThrow(SapoValidationError);
  });

  it('retries on 429 and respects Retry-After header', async () => {
    let callCount = 0;
    mswServer.use(
      http.get(`${API_BASE}/products.json`, () => {
        callCount++;
        if (callCount === 1) {
          return new HttpResponse(null, {
            status: 429,
            headers: { 'Retry-After': '1' },
          });
        }
        return HttpResponse.json({ products: [] });
      }),
    );

    const client = makeClient(3);
    const result = await client.get('/products.json');
    expect(result).toEqual({ products: [] });
    expect(callCount).toBe(2);
    expect(sleep).toHaveBeenCalledWith(1000); // Retry-After 1s → 1000ms
  });

  it('throws SapoRateLimitError after exhausting retries on 429', async () => {
    mswServer.use(
      http.get(
        `${API_BASE}/products.json`,
        () =>
          new HttpResponse(null, {
            status: 429,
            headers: { 'Retry-After': '1' },
          }),
      ),
    );

    const client = makeClient(2);
    await expect(client.get('/products.json')).rejects.toThrow(SapoRateLimitError);
  });

  it('retries on 5xx with exponential backoff', async () => {
    let callCount = 0;
    mswServer.use(
      http.get(`${API_BASE}/products.json`, () => {
        callCount++;
        if (callCount < 3) {
          return new HttpResponse('Server Error', { status: 500 });
        }
        return HttpResponse.json({ products: [{ id: 1 }] });
      }),
    );

    const client = makeClient(3);
    const result = await client.get('/products.json');
    expect(result).toEqual({ products: [{ id: 1 }] });
    expect(callCount).toBe(3);
    // Backoff schedule: 1000ms, 2000ms (between attempt 0→1, 1→2)
    expect(sleep).toHaveBeenNthCalledWith(1, 1000);
    expect(sleep).toHaveBeenNthCalledWith(2, 2000);
  });

  it('propagates caller AbortSignal without retrying', async () => {
    const controller = new AbortController();
    let callCount = 0;
    mswServer.use(
      http.get(`${API_BASE}/products.json`, async () => {
        callCount++;
        controller.abort();
        // Simulate slow server so abort lands mid-flight
        await new Promise((r) => setTimeout(r, 50));
        return HttpResponse.json({ products: [] });
      }),
    );

    const client = makeClient(3);
    await expect(client.get('/products.json', { signal: controller.signal })).rejects.toThrow();
    // Caller-abort must NOT retry
    expect(callCount).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('throws SapoServerError after exhausting retries on 5xx', async () => {
    mswServer.use(
      http.get(
        `${API_BASE}/products.json`,
        () => new HttpResponse('Internal Server Error', { status: 503 }),
      ),
    );

    const client = makeClient(2);
    await expect(client.get('/products.json')).rejects.toThrow(SapoServerError);
  });
});

describe('SapoClient POST/PUT/DELETE', () => {
  it('sends POST with JSON body', async () => {
    let receivedBody: unknown;
    mswServer.use(
      http.post(`${API_BASE}/orders.json`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({ order: { id: 42 } }, { status: 201 });
      }),
    );

    const client = makeClient();
    const result = await client.post('/orders.json', { order: { status: 'open' } });
    expect(result).toEqual({ order: { id: 42 } });
    expect(receivedBody).toEqual({ order: { status: 'open' } });
  });

  it('sends DELETE request', async () => {
    mswServer.use(
      http.delete(`${API_BASE}/orders/1.json`, () => new HttpResponse(null, { status: 204 })),
    );

    const client = makeClient();
    const result = await client.delete('/orders/1.json');
    expect(result).toEqual({});
  });
});

describe('SapoClient auth header', () => {
  it('sends Basic Auth header with requests', async () => {
    let authHeader: string | null = null;
    mswServer.use(
      http.get(`${API_BASE}/shop.json`, ({ request }) => {
        authHeader = request.headers.get('Authorization');
        return HttpResponse.json({ shop: { name: 'test' } });
      }),
    );

    const client = new SapoClient({
      store: TEST_STORE,
      apiKey: 'mykey',
      apiSecret: 'mysecret',
    });
    await client.get('/shop.json');

    expect(authHeader).toBeTruthy();
    expect(authHeader).toMatch(/^Basic /);
    const decoded = Buffer.from(authHeader?.replace('Basic ', ''), 'base64').toString('utf-8');
    expect(decoded).toBe('mykey:mysecret');
  });
});
