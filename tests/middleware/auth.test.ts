/**
 * Tests for src/middleware/auth.ts
 * Covers: bypass when no token configured, missing/malformed/invalid header → 401,
 * valid Bearer header → ok, timing-safe equality semantics.
 */

import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import { checkBearerAuth } from '../../src/middleware/auth.js';

function req(headers: Record<string, string | undefined>): Pick<IncomingMessage, 'headers'> {
  return { headers: headers as IncomingMessage['headers'] };
}

describe('checkBearerAuth', () => {
  it('bypasses (ok) when expectedToken is undefined regardless of header', () => {
    expect(checkBearerAuth(req({}), undefined)).toEqual({ ok: true });
    expect(checkBearerAuth(req({ authorization: 'Bearer anything' }), undefined)).toEqual({
      ok: true,
    });
  });

  it('rejects when token configured but no Authorization header', () => {
    const r = checkBearerAuth(req({}), 'secret');
    expect(r).toEqual({ ok: false, status: 401, reason: 'missing' });
  });

  it('rejects when Authorization header lacks Bearer scheme', () => {
    const r = checkBearerAuth(req({ authorization: 'Basic xyz' }), 'secret');
    expect(r).toEqual({ ok: false, status: 401, reason: 'malformed' });
  });

  it('rejects when token does not match', () => {
    const r = checkBearerAuth(req({ authorization: 'Bearer wrong' }), 'secret');
    expect(r).toEqual({ ok: false, status: 401, reason: 'invalid' });
  });

  it('rejects when token differs only in length (timing-safe path)', () => {
    const r = checkBearerAuth(req({ authorization: 'Bearer secre' }), 'secret');
    expect(r.ok).toBe(false);
  });

  it('accepts correct Bearer token', () => {
    const r = checkBearerAuth(req({ authorization: 'Bearer secret' }), 'secret');
    expect(r).toEqual({ ok: true });
  });

  it('accepts case-insensitive scheme name', () => {
    expect(checkBearerAuth(req({ authorization: 'bearer secret' }), 'secret').ok).toBe(true);
    expect(checkBearerAuth(req({ authorization: 'BEARER secret' }), 'secret').ok).toBe(true);
  });
});
