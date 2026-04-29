/**
 * Unit tests for probe-read runner.
 * Uses vi.stubGlobal to mock fetch — no real HTTP calls.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProbeResult } from '../../scripts/probe-read.js';
import { categorizeStatus, runProbe } from '../../scripts/probe-read.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeFetchResponse(status: number, body: unknown = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function makeFetchThatThrowsAbort(): () => never {
  return () => {
    const err = new DOMException('The operation was aborted.', 'AbortError');
    throw err;
  };
}

const BASE_ENV = {
  SAPO_STORE: 'myshop',
  SAPO_API_KEY: 'testapikey',
  SAPO_API_SECRET: 'testsecret',
};

// ─── categorizeStatus ────────────────────────────────────────────────────────

describe('categorizeStatus', () => {
  it('200 → available', () => {
    expect(categorizeStatus(200)).toBe('available');
  });

  it('201 → available', () => {
    expect(categorizeStatus(201)).toBe('available');
  });

  it('404 → not_found', () => {
    expect(categorizeStatus(404)).toBe('not_found');
  });

  it('401 → auth_failed', () => {
    expect(categorizeStatus(401)).toBe('auth_failed');
  });

  it('403 → forbidden (endpoint-specific, not auth fail)', () => {
    expect(categorizeStatus(403)).toBe('forbidden');
  });

  it('500 → error', () => {
    expect(categorizeStatus(500)).toBe('error');
  });

  it('503 → error', () => {
    expect(categorizeStatus(503)).toBe('error');
  });

  it('429 → error (rate limited)', () => {
    expect(categorizeStatus(429)).toBe('error');
  });
});

// ─── runProbe ────────────────────────────────────────────────────────────────

describe('runProbe', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('200 response → status "available"', async () => {
    fetchMock.mockResolvedValue(makeFetchResponse(200, { shop: {} }));

    const results = await runProbe(BASE_ENV, [
      {
        resource: 'shop',
        endpoint: '/admin/shop.json',
        method: 'GET',
        bucket: 'A',
        critical: true,
      },
    ]);

    expect(results[0].status).toBe('available');
    expect(results[0].resource).toBe('shop');
  });

  it('404 response → status "not_found"', async () => {
    fetchMock.mockResolvedValue(makeFetchResponse(404));

    const results = await runProbe(BASE_ENV, [
      {
        resource: 'pos_shifts',
        endpoint: '/admin/pos_shifts.json',
        method: 'GET',
        bucket: 'B',
      },
    ]);

    expect(results[0].status).toBe('not_found');
  });

  it('401 → auth_failed + early exit (subsequent entries skipped)', async () => {
    fetchMock.mockResolvedValue(makeFetchResponse(401));

    const matrix = [
      { resource: 'shop', endpoint: '/admin/shop.json', method: 'GET', bucket: 'A' as const },
      {
        resource: 'products',
        endpoint: '/admin/products.json',
        method: 'GET',
        bucket: 'A' as const,
      },
      {
        resource: 'orders',
        endpoint: '/admin/orders.json',
        method: 'GET',
        bucket: 'A' as const,
      },
    ];

    const results = await runProbe(BASE_ENV, matrix);

    // Auth fail should cause early exit — not all items probed
    const authFailed = results.filter((r) => r.status === 'auth_failed');
    expect(authFailed.length).toBeGreaterThan(0);

    // Should NOT have probed all 3 (early exit)
    expect(results.length).toBeLessThan(matrix.length);
  });

  it('500 then 200 → retries once → status "available"', async () => {
    fetchMock
      .mockResolvedValueOnce(makeFetchResponse(500))
      .mockResolvedValueOnce(makeFetchResponse(200, { products: [] }));

    const results = await runProbe(BASE_ENV, [
      {
        resource: 'products',
        endpoint: '/admin/products.json',
        method: 'GET',
        bucket: 'A' as const,
      },
    ]);

    expect(results[0].status).toBe('available');
    expect(fetchMock).toHaveBeenCalledTimes(2); // initial + 1 retry
  });

  it('500 twice → status "error"', async () => {
    fetchMock.mockResolvedValue(makeFetchResponse(500));

    const results = await runProbe(BASE_ENV, [
      {
        resource: 'products',
        endpoint: '/admin/products.json',
        method: 'GET',
        bucket: 'A' as const,
      },
    ]);

    expect(results[0].status).toBe('error');
    expect(fetchMock).toHaveBeenCalledTimes(2); // initial + 1 retry = 2 total
  });

  it('AbortError (timeout) → status "timeout"', async () => {
    fetchMock.mockImplementation(makeFetchThatThrowsAbort());

    const results = await runProbe(BASE_ENV, [
      { resource: 'shop', endpoint: '/admin/shop.json', method: 'GET', bucket: 'A' as const },
    ]);

    expect(results[0].status).toBe('timeout');
  });

  it('network error → retries once then → status "error"', async () => {
    fetchMock.mockRejectedValue(new Error('network error'));

    const results = await runProbe(BASE_ENV, [
      { resource: 'shop', endpoint: '/admin/shop.json', method: 'GET', bucket: 'A' as const },
    ]);

    expect(results[0].status).toBe('error');
    // Called twice: initial + 1 retry
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('credentials never appear in result output', async () => {
    fetchMock.mockRejectedValue(new Error(`auth failed for testapikey:testsecret`));

    const results = await runProbe(BASE_ENV, [
      { resource: 'shop', endpoint: '/admin/shop.json', method: 'GET', bucket: 'A' as const },
    ]);

    // Check error message in result doesn't contain raw credentials
    for (const r of results) {
      if (r.errorMessage) {
        expect(r.errorMessage).not.toContain('testapikey');
        expect(r.errorMessage).not.toContain('testsecret');
      }
    }
  });

  it('basic auth header sent with requests', async () => {
    fetchMock.mockResolvedValue(makeFetchResponse(200));

    await runProbe(BASE_ENV, [
      { resource: 'shop', endpoint: '/admin/shop.json', method: 'GET', bucket: 'A' as const },
    ]);

    const callArgs = fetchMock.mock.calls[0];
    const init = callArgs[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Basic /);
    // Must NOT contain raw credentials
    expect(headers.Authorization).not.toContain('testapikey');
    const decoded = Buffer.from(headers.Authorization.replace('Basic ', ''), 'base64').toString(
      'utf8',
    );
    expect(decoded).toBe('testapikey:testsecret');
  });
});

// ─── ProbeResult shape ───────────────────────────────────────────────────────

describe('ProbeResult type', () => {
  it('result has required fields', async () => {
    const fetch = vi.fn().mockResolvedValue(makeFetchResponse(200));
    vi.stubGlobal('fetch', fetch);

    const results = await runProbe(BASE_ENV, [
      { resource: 'shop', endpoint: '/admin/shop.json', method: 'GET', bucket: 'A' as const },
    ]);

    const r = results[0] as ProbeResult;
    expect(r).toHaveProperty('resource');
    expect(r).toHaveProperty('endpoint');
    expect(r).toHaveProperty('status');
    expect(r).toHaveProperty('bucket');
    expect(r).toHaveProperty('httpStatus');
    expect(r).toHaveProperty('durationMs');

    vi.unstubAllGlobals();
  });
});

// ─── Report generation ───────────────────────────────────────────────────────

describe('generateMarkdownReport', () => {
  it('report contains Bucket A section', async () => {
    const fetch = vi.fn().mockResolvedValue(makeFetchResponse(200));
    vi.stubGlobal('fetch', fetch);

    const { generateMarkdownReport } = await import('../../scripts/probe-read.js');

    const results: ProbeResult[] = [
      {
        resource: 'shop',
        endpoint: '/admin/shop.json',
        status: 'available',
        bucket: 'A',
        httpStatus: 200,
        durationMs: 100,
      },
    ];

    const report = generateMarkdownReport(results, new Date('2026-04-30'));
    expect(report).toContain('Bucket A');
    expect(report).toContain('shop');

    vi.unstubAllGlobals();
  });

  it('report contains Bucket B section', async () => {
    const { generateMarkdownReport } = await import('../../scripts/probe-read.js');

    const results: ProbeResult[] = [
      {
        resource: 'pos_shifts',
        endpoint: '/admin/pos_shifts.json',
        status: 'not_found',
        bucket: 'B',
        httpStatus: 404,
        durationMs: 50,
      },
    ];

    const report = generateMarkdownReport(results, new Date('2026-04-30'));
    expect(report).toContain('Bucket B');
    expect(report).toContain('pos_shifts');
  });

  it('report contains Decision Gate section', async () => {
    const { generateMarkdownReport } = await import('../../scripts/probe-read.js');

    const results: ProbeResult[] = [
      {
        resource: 'suppliers',
        endpoint: '/admin/suppliers.json',
        status: 'available',
        bucket: 'B',
        httpStatus: 200,
        durationMs: 80,
      },
    ];

    const report = generateMarkdownReport(results, new Date('2026-04-30'));
    expect(report).toContain('Decision Gate');
    expect(report).toContain('G1');
    expect(report).toContain('G2');
  });

  it('G1 recommendation "full" when ≥5 Bucket B available', async () => {
    const { generateMarkdownReport } = await import('../../scripts/probe-read.js');

    const results: ProbeResult[] = Array.from({ length: 6 }, (_, i) => ({
      resource: `res_${i}`,
      endpoint: `/admin/res_${i}.json`,
      status: 'available' as const,
      bucket: 'B' as const,
      httpStatus: 200,
      durationMs: 50,
    }));

    const report = generateMarkdownReport(results, new Date('2026-04-30'));
    expect(report).toContain('full');
  });

  it('G1 recommendation "partial" when 2-4 Bucket B available', async () => {
    const { generateMarkdownReport } = await import('../../scripts/probe-read.js');

    const results: ProbeResult[] = Array.from({ length: 3 }, (_, i) => ({
      resource: `res_${i}`,
      endpoint: `/admin/res_${i}.json`,
      status: 'available' as const,
      bucket: 'B' as const,
      httpStatus: 200,
      durationMs: 50,
    }));

    const report = generateMarkdownReport(results, new Date('2026-04-30'));
    expect(report).toContain('partial');
  });

  it('G1 recommendation "defer" when <2 Bucket B available', async () => {
    const { generateMarkdownReport } = await import('../../scripts/probe-read.js');

    const results: ProbeResult[] = [
      {
        resource: 'suppliers',
        endpoint: '/admin/suppliers.json',
        status: 'not_found',
        bucket: 'B',
        httpStatus: 404,
        durationMs: 50,
      },
    ];

    const report = generateMarkdownReport(results, new Date('2026-04-30'));
    expect(report).toContain('defer');
  });

  it('report generated date appears in header', async () => {
    const { generateMarkdownReport } = await import('../../scripts/probe-read.js');
    const results: ProbeResult[] = [];
    const report = generateMarkdownReport(results, new Date('2026-04-30'));
    expect(report).toContain('2026-04-30');
  });

  it('G2 shows "Skipped - production store" note', async () => {
    const { generateMarkdownReport } = await import('../../scripts/probe-read.js');
    const results: ProbeResult[] = [];
    const report = generateMarkdownReport(results, new Date('2026-04-30'));
    expect(report).toContain('production');
  });

  it('report does not contain raw credential values', async () => {
    const { generateMarkdownReport } = await import('../../scripts/probe-read.js');

    const results: ProbeResult[] = [
      {
        resource: 'shop',
        endpoint: '/admin/shop.json',
        status: 'available',
        bucket: 'A',
        httpStatus: 200,
        durationMs: 100,
        errorMessage: 'testapikey:testsecret exposed in error',
      },
    ];

    const report = generateMarkdownReport(results, new Date('2026-04-30'));
    // Report should not contain raw credential strings when masked
    expect(report).not.toContain('testapikey:testsecret exposed in error');
  });

  it('report contains "Generated by npm run probe" header', async () => {
    const { generateMarkdownReport } = await import('../../scripts/probe-read.js');
    const results: ProbeResult[] = [];
    const report = generateMarkdownReport(results, new Date('2026-04-30'));
    expect(report).toContain('npm run probe');
  });
});
