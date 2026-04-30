/**
 * sapo-mcp CLI entry point.
 * Note: shebang is injected by tsup banner config.
 *
 * Usage:
 *   sapo-mcp --mode=pos-online
 *   sapo-mcp --mode=pos-online,web --transport=stdio
 *   sapo-mcp --help
 *   sapo-mcp --version
 *
 * Transport support:
 *   stdio (default) — implemented Phase 5
 *   http            — Phase 7
 *
 * IMPORTANT: stdout is the JSON-RPC channel. Never write to stdout except
 * for --help and --version output (server is not running in those paths).
 * All runtime logging must go to stderr via the logger.
 */

import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SapoConfig } from './config.js';
import { loadConfig, validateHttpConfig } from './config.js';
import { createLogger } from './logger.js';
import type { ModeName } from './modes/registry.js';
import { parseModes } from './modes/registry.js';
import { createServer } from './server.js';
import { startHttpTransport } from './transports/http.js';
import { connectStdio } from './transports/stdio.js';

const VALID_TRANSPORTS = ['stdio', 'http'] as const;
type Transport = (typeof VALID_TRANSPORTS)[number];

/**
 * Pure function: returns CLI help text.
 * Exported for unit tests.
 */
export function buildHelpText(): string {
  return [
    'sapo-mcp — Model Context Protocol server for Sapo.vn',
    '',
    'Usage:',
    '  sapo-mcp [options]',
    '',
    'Options:',
    '  --mode=<modes>        Comma-separated list of modes to enable (default: pos-online)',
    '                        Available in 0.2.0: pos-online, web, pos-counter',
    '                        Reserved (not yet implemented): analytics',
    '  --transport=<type>    Transport protocol (default: stdio)',
    '                        Valid values: stdio, http',
    '  --port=<port>         HTTP port (default: 3333; ignored for stdio)',
    '  --version             Print package version and exit',
    '  --help                Print this help text and exit',
    '',
    'Examples:',
    '  sapo-mcp --mode=pos-online',
    '  sapo-mcp --mode=pos-online,web --transport=stdio',
    '  sapo-mcp --mode=pos-online --transport=http --port=3333',
    '',
    'Environment variables:',
    '  SAPO_STORE            Required. Sapo store subdomain (e.g. mystore)',
    '  SAPO_API_KEY          Required. Sapo API key',
    '  SAPO_API_SECRET       Required (or SAPO_API_SECRET_FILE). Sapo API secret',
    '  SAPO_API_SECRET_FILE  Path to file containing API secret (preferred, avoids /proc exposure)',
    '  SAPO_ALLOW_OPS        Optional. Comma-separated destructive ops to enable',
    '                        Values: cancel, delete, delete_strict, inventory_set, *',
    '  SAPO_LOG_LEVEL        Optional. Log level (default: info)',
    '                        Values: error, warn, info, debug, trace',
    '  SAPO_LOG_PII          Optional. Enable PII in trace logs (default: false)',
    '  SAPO_MAX_AUTO_PAGES   Optional. Max pages for auto-pagination (default: 10)',
    '  SAPO_RETRY_MAX        Optional. Max HTTP retry count (default: 3)',
    '  SAPO_HTTP_HOST        Optional. HTTP bind host (default: 127.0.0.1)',
    '  SAPO_HTTP_PORT        Optional. HTTP port (default: 3333)',
    '  SAPO_HTTP_MAX_SESSIONS         Optional. Max concurrent sessions (default: 100)',
    '  SAPO_HTTP_SESSION_IDLE_MS      Optional. Idle session GC ms (default: 1800000)',
    '  SAPO_MCP_AUTH_TOKEN   Optional. Bearer token. REQUIRED if SAPO_HTTP_HOST is non-loopback',
    '  SAPO_HTTP_CORS_ORIGINS         Optional. CSV of allowed CORS origins (default: disabled)',
  ].join('\n');
}

/**
 * Read package version using createRequire to avoid JSON import assertions
 * compatibility issues across Node versions.
 * Falls back to '0.0.0' if package.json cannot be read.
 */
export function readPackageVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    // Resolves relative to src/index.ts (dev) → ../package.json = project root
    // Or dist/index.mjs (prod) → ../package.json = project root
    const pkg = require('../package.json') as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function parseArg(args: string[], prefix: string): string | undefined {
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // --help: print usage and exit (before any config loading)
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(`${buildHelpText()}\n`);
    process.exit(0);
  }

  // --version: print semver and exit (before any config loading)
  if (args.includes('--version') || args.includes('-v')) {
    process.stdout.write(`${readPackageVersion()}\n`);
    process.exit(0);
  }

  // --mode=<mode[,mode...]>
  const modeArg = parseArg(args, '--mode=') ?? 'pos-online';
  const transportArg = parseArg(args, '--transport=') ?? 'stdio';
  const portArg = parseArg(args, '--port=');

  // Validate transport before loading config (fast-fail on typos)
  if (!VALID_TRANSPORTS.includes(transportArg as Transport)) {
    process.stderr.write(
      `sapo-mcp error: Invalid transport "${transportArg}". Valid values: ${VALID_TRANSPORTS.join(', ')}\n`,
    );
    process.exit(1);
  }
  const transport = transportArg as Transport;

  // Load and validate config — throws with descriptive field list on failure
  let config: SapoConfig;
  try {
    config = loadConfig();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`sapo-mcp configuration error:\n${msg}\n`);
    process.exit(1);
    // process.exit is typed as `never`; this unreachable assignment satisfies narrowing
    throw new Error('unreachable');
  }

  const logger = createLogger(config.logLevel, config.logPii);

  // Validate modes early (fails fast with clear error)
  let modes: ModeName[];
  try {
    modes = parseModes(modeArg);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`sapo-mcp error: ${msg}\n`);
    process.exit(1);
    throw new Error('unreachable');
  }

  logger.info('Starting sapo-mcp', { modes, transport });

  if (transport === 'stdio') {
    const server = createServer({ modes, config });
    const shutdown = (signal: string): void => {
      logger.info('sapo-mcp shutting down', { signal });
      process.exit(0);
    };
    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    await connectStdio(server, logger);
    return;
  }

  // http transport
  const httpConfig = portArg ? { ...config.http, port: Number.parseInt(portArg, 10) } : config.http;
  if (Number.isNaN(httpConfig.port) || httpConfig.port < 1 || httpConfig.port > 65535) {
    process.stderr.write(`sapo-mcp error: Invalid --port value "${portArg}"\n`);
    process.exit(1);
  }
  try {
    validateHttpConfig(httpConfig);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`sapo-mcp http config error: ${msg}\n`);
    process.exit(1);
    throw new Error('unreachable');
  }

  const running = startHttpTransport({
    http: httpConfig,
    logger,
    createMcpServer: () => createServer({ modes, config }),
    version: readPackageVersion(),
    modes,
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info('sapo-mcp shutting down', { signal });
    try {
      await running.shutdown();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('shutdown error', { error: msg });
    }
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

// Only run when executed directly as the entry point, not when imported as a module.
// Resolves symlinks so invocations via node_modules/.bin/sapo-mcp (which links to
// dist/index.mjs) match modulePath. Guards main() during unit tests that import
// exported pure functions.
const modulePath = fileURLToPath(import.meta.url);
let entryPath = '';
if (process.argv[1]) {
  try {
    entryPath = realpathSync(resolve(process.argv[1]));
  } catch {
    entryPath = resolve(process.argv[1]);
  }
}
const isDirectRun =
  modulePath === entryPath || entryPath.endsWith('index.mjs') || entryPath.endsWith('index.cjs');

if (isDirectRun) {
  main().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`sapo-mcp fatal error: ${msg}\n`);
    process.exit(1);
  });
}
