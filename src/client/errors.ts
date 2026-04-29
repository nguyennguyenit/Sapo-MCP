/**
 * SapoError hierarchy + MCP tool response mapper.
 *
 * HTTP → Error mapping:
 *   401/403 → SapoAuthError
 *   404     → SapoNotFoundError
 *   422     → SapoValidationError
 *   429     → SapoRateLimitError (internal, retried by http client)
 *   5xx     → SapoServerError
 *   other   → SapoError (base)
 */

export class SapoError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'SapoError';
    this.status = status;
    this.code = code;
  }
}

export class SapoAuthError extends SapoError {
  constructor(message = 'Authentication failed. Check SAPO_API_KEY and SAPO_API_SECRET.') {
    super(message, 401, 'auth_failed');
    this.name = 'SapoAuthError';
  }
}

export class SapoNotFoundError extends SapoError {
  constructor(resource = 'Resource') {
    super(`${resource} not found.`, 404, 'not_found');
    this.name = 'SapoNotFoundError';
  }
}

export class SapoValidationError extends SapoError {
  readonly detail: unknown;

  constructor(message: string, detail?: unknown) {
    super(message, 422, 'validation');
    this.name = 'SapoValidationError';
    this.detail = detail;
  }
}

export class SapoRateLimitError extends SapoError {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(`Rate limited. Retry after ${retryAfterMs}ms.`, 429, 'rate_limit');
    this.name = 'SapoRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class SapoServerError extends SapoError {
  constructor(status: number, message = 'Sapo service error. Try again later.') {
    super(message, status, 'server_error');
    this.name = 'SapoServerError';
  }
}

/**
 * Map a SapoError (or unknown error) to an MCP tool error response object.
 * Use as: return mapErrorToMcpResponse(err);
 */
export function mapErrorToMcpResponse(err: unknown): {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
} {
  let text: string;

  if (err instanceof SapoError) {
    text = `[${err.code}] ${err.message}`;
  } else if (err instanceof Error) {
    text = `Unexpected error: ${err.message}`;
  } else {
    text = `Unexpected error: ${String(err)}`;
  }

  return {
    content: [{ type: 'text', text }],
    isError: true,
  };
}

/**
 * Build a SapoError from an HTTP response.
 * Reads body for 422 detail; does not retry 401/404/422.
 */
export async function buildErrorFromResponse(response: Response): Promise<SapoError> {
  const status = response.status;

  if (status === 401 || status === 403) {
    return new SapoAuthError();
  }

  if (status === 404) {
    return new SapoNotFoundError();
  }

  if (status === 429) {
    const retryAfterHeader = response.headers.get('Retry-After');
    const parsed = retryAfterHeader ? parseFloat(retryAfterHeader) : NaN;
    // Defensive: HTTP-date format or malformed → fallback to 1s
    const retryAfterMs = Number.isFinite(parsed) && parsed > 0 ? parsed * 1000 : 1000;
    return new SapoRateLimitError(retryAfterMs);
  }

  if (status === 422) {
    let detail: unknown;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text().catch(() => '');
    }
    const msg =
      typeof detail === 'object' && detail !== null && 'errors' in detail
        ? `Validation error: ${JSON.stringify((detail as Record<string, unknown>).errors)}`
        : `Validation error (${status})`;
    return new SapoValidationError(msg, detail);
  }

  if (status >= 500) {
    return new SapoServerError(status);
  }

  return new SapoError(`Unexpected HTTP ${status}`, status, 'unknown');
}
