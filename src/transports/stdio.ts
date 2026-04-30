/**
 * stdio transport setup for sapo-mcp.
 * Encapsulates StdioServerTransport wiring.
 *
 * stdout MUST remain clean (JSON-RPC channel).
 * All logging goes to stderr via the provided logger.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Logger } from '../logger.js';

/**
 * Connect the MCP server to stdin/stdout via stdio transport.
 * Awaits the connection before returning.
 */
export async function connectStdio(server: McpServer, logger: Logger): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('sapo-mcp running on stdio');
}
