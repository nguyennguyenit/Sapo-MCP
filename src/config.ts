/**
 * ENV configuration validation via zod.
 * All Sapo MCP config is read from environment variables at startup.
 * Credentials file fallback: SAPO_API_SECRET_FILE takes precedence over SAPO_API_SECRET.
 */
import { readFileSync } from 'node:fs';
import { z } from 'zod';

// Allowed destructive operation categories
export const DESTRUCTIVE_CATEGORIES = [
  'cancel',
  'delete',
  'delete_strict',
  'inventory_set',
  'shift_close',
  'cashbook_write',
] as const;
export type DestructiveCategory = (typeof DESTRUCTIVE_CATEGORIES)[number];

const LOG_LEVELS = ['error', 'warn', 'info', 'debug', 'trace'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const envSchema = z.object({
  SAPO_STORE: z.string().min(1, 'SAPO_STORE is required'),
  SAPO_API_KEY: z.string().min(1, 'SAPO_API_KEY is required'),
  // One of SAPO_API_SECRET or SAPO_API_SECRET_FILE required (validated below)
  SAPO_API_SECRET: z.string().optional(),
  SAPO_API_SECRET_FILE: z.string().optional(),
  SAPO_ALLOW_OPS: z.string().default(''),
  SAPO_MAX_AUTO_PAGES: z.coerce.number().int().min(1).max(100).default(10),
  SAPO_RETRY_MAX: z.coerce.number().int().min(0).max(10).default(3),
  SAPO_LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  // Strict opt-in: only "1" or "true" (case-insensitive) enables PII logging.
  // z.coerce.boolean() treats any non-empty string as true, so "0" would enable it.
  SAPO_LOG_PII: z
    .string()
    .optional()
    .transform((v) => v === '1' || v?.toLowerCase() === 'true'),
});

export interface SapoConfig {
  store: string;
  apiKey: string;
  apiSecret: string;
  allowOps: Set<DestructiveCategory | '*'>;
  maxAutoPages: number;
  retryMax: number;
  logLevel: LogLevel;
  logPii: boolean;
}

/**
 * Parse SAPO_ALLOW_OPS CSV into a typed set.
 * Accepts '*' (all) or comma-separated category names.
 */
function parseAllowOps(raw: string): Set<DestructiveCategory | '*'> {
  const trimmed = raw.trim();
  if (!trimmed) return new Set();
  if (trimmed === '*') return new Set(['*']);

  const parts = trimmed.split(',').map((s) => s.trim());
  const result = new Set<DestructiveCategory | '*'>();
  const valid = new Set<string>(DESTRUCTIVE_CATEGORIES);

  for (const part of parts) {
    if (!valid.has(part)) {
      throw new Error(
        `Invalid SAPO_ALLOW_OPS value: "${part}". ` +
          `Valid values: ${DESTRUCTIVE_CATEGORIES.join(', ')}, *`,
      );
    }
    result.add(part as DestructiveCategory);
  }
  return result;
}

/**
 * Resolve API secret from file or direct env var.
 * File takes precedence to mitigate /proc/environ exposure.
 */
function resolveApiSecret(
  secretFile: string | undefined,
  secretDirect: string | undefined,
): string {
  if (secretFile) {
    try {
      return readFileSync(secretFile, 'utf-8').trim();
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? 'UNKNOWN';
      throw new Error(`Failed to read SAPO_API_SECRET_FILE: ${code}`);
    }
  }
  if (secretDirect) return secretDirect;
  throw new Error('Either SAPO_API_SECRET or SAPO_API_SECRET_FILE is required');
}

/**
 * Parse and validate all Sapo MCP configuration from process.env.
 * Throws with descriptive field list on validation failure.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): SapoConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Sapo MCP configuration errors:\n${fields.join('\n')}`);
  }

  const data = parsed.data;
  const apiSecret = resolveApiSecret(data.SAPO_API_SECRET_FILE, data.SAPO_API_SECRET);
  const allowOps = parseAllowOps(data.SAPO_ALLOW_OPS);

  return {
    store: data.SAPO_STORE,
    apiKey: data.SAPO_API_KEY,
    apiSecret,
    allowOps,
    maxAutoPages: data.SAPO_MAX_AUTO_PAGES,
    retryMax: data.SAPO_RETRY_MAX,
    logLevel: data.SAPO_LOG_LEVEL,
    logPii: data.SAPO_LOG_PII,
  };
}
