/**
 * sapo-mcp CLI entry point.
 * Note: shebang is injected by tsup banner config.
 *
 * Usage:
 *   sapo-mcp --mode=pos-online
 *   sapo-mcp --mode=pos-online,web --transport=stdio
 *
 * Transport support:
 *   stdio (default) — Phase 2 scaffold; full implementation Phase 5
 *   http            — Phase 7
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { parseModes } from './modes/registry.js';
import { createServer } from './server.js';

function parseArg(args: string[], prefix: string): string | undefined {
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // --mode=<mode[,mode...]>
  const modeArg = parseArg(args, '--mode=') ?? 'pos-online';
  // --transport=<stdio|http> (http stub — Phase 7)
  const transport = parseArg(args, '--transport=') ?? 'stdio';

  // Load and validate config
  const config = loadConfig();
  const logger = createLogger(config.logLevel, config.logPii);

  // Validate modes early (fails fast with clear error)
  const modes = parseModes(modeArg);

  logger.info(`Starting sapo-mcp`, { modes, transport });

  const server = createServer({ modes, config });

  if (transport === 'stdio') {
    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);
    logger.info('sapo-mcp running on stdio');
  } else {
    // HTTP transport — Phase 7 implementation
    logger.error(`Transport "${transport}" not yet implemented. Use --transport=stdio`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`sapo-mcp fatal error: ${msg}\n`);
  process.exit(1);
});
