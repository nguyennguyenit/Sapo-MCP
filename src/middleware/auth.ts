/**
 * Bearer token auth check for HTTP transport.
 *
 * Behavior:
 *   - If `expectedToken` is undefined → bypass (allow). Used when host is
 *     loopback and no token configured.
 *   - Otherwise the request MUST present `Authorization: Bearer <token>`
 *     matching `expectedToken` exactly via timing-safe comparison.
 */

import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export type AuthCheckResult =
  | { ok: true }
  | { ok: false; status: 401; reason: 'missing' | 'malformed' | 'invalid' };

/**
 * Pure check: compares the request's Authorization header against the
 * expected token. Does not write to the response — caller decides how to
 * surface 401s (HTTP body, JSON-RPC error, etc.).
 */
export function checkBearerAuth(
  req: Pick<IncomingMessage, 'headers'>,
  expectedToken: string | undefined,
): AuthCheckResult {
  if (!expectedToken) return { ok: true };

  const header = req.headers.authorization;
  if (!header) return { ok: false, status: 401, reason: 'missing' };

  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return { ok: false, status: 401, reason: 'malformed' };

  const presented = match[1].trim();
  if (!safeEqual(presented, expectedToken)) {
    return { ok: false, status: 401, reason: 'invalid' };
  }
  return { ok: true };
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
