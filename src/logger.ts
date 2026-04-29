/**
 * Stderr-only logger with PII redaction policy.
 *
 * PII policy:
 *   info  — never logs response body; only {method, url, status, duration_ms}
 *   debug — logs body with known PII keys redacted to "***"
 *   trace — full body (opt-in via SAPO_LOG_PII=1; document risk before enabling)
 *
 * Redacted keys (recursive in nested objects/arrays):
 *   phone, phone_number, mobile, tel,
 *   email, email_address,
 *   name, first_name, last_name, full_name,
 *   address, address1, address2, street, province, district, ward,
 *   national_id, tax_code, vat_number,
 *   payment_account, card_number, bank_account
 */

import type { LogLevel } from './config.js';

// All keys to redact (lowercase for case-insensitive match)
const PII_KEYS = new Set([
  'phone',
  'phone_number',
  'mobile',
  'tel',
  'email',
  'email_address',
  'name',
  'first_name',
  'last_name',
  'full_name',
  'address',
  'address1',
  'address2',
  'street',
  'province',
  'district',
  'ward',
  'national_id',
  'tax_code',
  'vat_number',
  'payment_account',
  'card_number',
  'bank_account',
]);

const LEVEL_RANK: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

/**
 * Recursively redact PII keys in a value (object, array, or primitive).
 */
export function redactPii(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactPii);
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = PII_KEYS.has(k.toLowerCase()) ? '***' : redactPii(v);
    }
    return result;
  }
  return value;
}

/**
 * Mask credentials in Authorization header values.
 * Replaces "Basic <token>" with "Basic ***".
 */
export function maskCredentials(headers: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    masked[k] = k.toLowerCase() === 'authorization' ? v.replace(/Basic\s+\S+/i, 'Basic ***') : v;
  }
  return masked;
}

export interface Logger {
  error(msg: string, data?: unknown): void;
  warn(msg: string, data?: unknown): void;
  info(msg: string, data?: unknown): void;
  debug(msg: string, data?: unknown): void;
  trace(msg: string, data?: unknown): void;
}

export function createLogger(level: LogLevel, logPii = false): Logger {
  const minRank = LEVEL_RANK[level];

  function log(msgLevel: LogLevel, msg: string, data?: unknown): void {
    if (LEVEL_RANK[msgLevel] > minRank) return;

    const entry: Record<string, unknown> = {
      level: msgLevel,
      time: new Date().toISOString(),
      msg,
    };

    if (data !== undefined) {
      // Apply PII redaction at debug level unless opt-in PII logging
      entry.data = msgLevel === 'trace' && logPii ? data : redactPii(data);
    }

    process.stderr.write(`${JSON.stringify(entry)}\n`);
  }

  return {
    error: (msg, data) => log('error', msg, data),
    warn: (msg, data) => log('warn', msg, data),
    info: (msg, data) => log('info', msg, data),
    debug: (msg, data) => log('debug', msg, data),
    trace: (msg, data) => log('trace', msg, data),
  };
}
