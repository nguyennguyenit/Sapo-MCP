/**
 * Tests for src/client/errors.ts
 * Covers: error hierarchy, MCP mapper, HTTP response → error conversion
 */
import { describe, expect, it } from 'vitest';
import {
  buildErrorFromResponse,
  mapErrorToMcpResponse,
  SapoAuthError,
  SapoError,
  SapoNotFoundError,
  SapoRateLimitError,
  SapoServerError,
  SapoValidationError,
} from '../../src/client/errors.js';

describe('SapoError hierarchy', () => {
  it('SapoError has status and code', () => {
    const err = new SapoError('test', 500, 'test_code');
    expect(err.status).toBe(500);
    expect(err.code).toBe('test_code');
    expect(err.message).toBe('test');
    expect(err).toBeInstanceOf(Error);
  });

  it('SapoAuthError has code auth_failed and status 401', () => {
    const err = new SapoAuthError();
    expect(err.status).toBe(401);
    expect(err.code).toBe('auth_failed');
    expect(err).toBeInstanceOf(SapoError);
  });

  it('SapoNotFoundError has code not_found and status 404', () => {
    const err = new SapoNotFoundError('Order');
    expect(err.status).toBe(404);
    expect(err.code).toBe('not_found');
    expect(err.message).toContain('Order');
  });

  it('SapoValidationError stores detail', () => {
    const detail = { field: 'is invalid' };
    const err = new SapoValidationError('Validation error: field: is invalid', detail);
    expect(err.detail).toEqual(detail);
    expect(err.status).toBe(422);
  });

  it('SapoRateLimitError stores retryAfterMs', () => {
    const err = new SapoRateLimitError(2000);
    expect(err.retryAfterMs).toBe(2000);
    expect(err.status).toBe(429);
  });

  it('SapoServerError has status 5xx', () => {
    const err = new SapoServerError(503);
    expect(err.status).toBe(503);
    expect(err.code).toBe('server_error');
  });
});

describe('mapErrorToMcpResponse', () => {
  it('maps SapoError to MCP error response', () => {
    const err = new SapoAuthError();
    const response = mapErrorToMcpResponse(err);
    expect(response.isError).toBe(true);
    expect(response.content[0].type).toBe('text');
    expect(response.content[0].text).toContain('auth_failed');
  });

  it('maps unknown Error to generic message', () => {
    const err = new Error('something went wrong');
    const response = mapErrorToMcpResponse(err);
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('something went wrong');
  });

  it('maps non-Error to string representation', () => {
    const response = mapErrorToMcpResponse('raw string error');
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('raw string error');
  });
});

describe('buildErrorFromResponse', () => {
  function makeResponse(status: number, body?: string, headers?: Record<string, string>): Response {
    return new Response(body ?? '', { status, headers });
  }

  it('returns SapoAuthError on 401', async () => {
    const err = await buildErrorFromResponse(makeResponse(401));
    expect(err).toBeInstanceOf(SapoAuthError);
  });

  it('returns SapoAuthError on 403', async () => {
    const err = await buildErrorFromResponse(makeResponse(403));
    expect(err).toBeInstanceOf(SapoAuthError);
  });

  it('returns SapoNotFoundError on 404', async () => {
    const err = await buildErrorFromResponse(makeResponse(404));
    expect(err).toBeInstanceOf(SapoNotFoundError);
  });

  it('returns SapoRateLimitError on 429 with Retry-After', async () => {
    const response = makeResponse(429, '', { 'Retry-After': '2' });
    const err = await buildErrorFromResponse(response);
    expect(err).toBeInstanceOf(SapoRateLimitError);
    expect((err as SapoRateLimitError).retryAfterMs).toBe(2000);
  });

  it('defaults Retry-After to 1000ms when header absent', async () => {
    const response = makeResponse(429);
    const err = await buildErrorFromResponse(response);
    expect(err).toBeInstanceOf(SapoRateLimitError);
    expect((err as SapoRateLimitError).retryAfterMs).toBe(1000);
  });

  it('returns SapoValidationError on 422 with JSON errors', async () => {
    const response = new Response(JSON.stringify({ errors: { status: 'invalid' } }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
    const err = await buildErrorFromResponse(response);
    expect(err).toBeInstanceOf(SapoValidationError);
    expect(err.message).toContain('Validation error');
  });

  it('returns SapoServerError on 500', async () => {
    const err = await buildErrorFromResponse(makeResponse(500));
    expect(err).toBeInstanceOf(SapoServerError);
  });

  it('returns SapoServerError on 503', async () => {
    const err = await buildErrorFromResponse(makeResponse(503));
    expect(err).toBeInstanceOf(SapoServerError);
    expect((err as SapoServerError).status).toBe(503);
  });

  it('returns SapoError for unexpected status codes', async () => {
    const err = await buildErrorFromResponse(makeResponse(418));
    expect(err).toBeInstanceOf(SapoError);
    expect(err.status).toBe(418);
  });
});
