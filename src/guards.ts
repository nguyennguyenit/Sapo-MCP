/**
 * Category-based destructive operation guard.
 *
 * Controls whether a destructive tool is registered with the MCP server.
 * Tools are classified into categories; each category must be explicitly
 * enabled via SAPO_ALLOW_OPS or a per-tool override.
 *
 * Decision flow:
 *   1. Per-tool override: SAPO_ALLOW_TOOL_<UPPERCASE_NAME>=1 → always register
 *   2. allowOps has '*' → register all destructive tools
 *   3. allowOps has tool's category → register
 *   4. Default: skip + log warning
 */

import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { DestructiveCategory } from './config.js';
import type { Logger } from './logger.js';

export interface DestructiveToolDef<Args extends ZodRawShapeCompat> {
  /** Unique tool name (snake_case) */
  name: string;
  /** Destructive operation category */
  category: DestructiveCategory;
  /** Tool description shown to LLM */
  description: string;
  /** Input schema (ZodRawShape) */
  inputSchema: Args;
  /** Async handler */
  handler: ToolCallback<Args>;
}

export interface GuardContext {
  /** Set of allowed categories from SAPO_ALLOW_OPS parsing */
  allowOps: Set<DestructiveCategory | '*'>;
  /** process.env reference for per-tool override check */
  env?: NodeJS.ProcessEnv;
  logger?: Logger;
}

/**
 * Attempt to register a destructive tool with the MCP server.
 * Returns true if registered, false if skipped.
 */
export function registerIfAllowed<Args extends ZodRawShapeCompat>(
  server: McpServer,
  tool: DestructiveToolDef<Args>,
  ctx: GuardContext,
): boolean {
  const env = ctx.env ?? process.env;
  const logger = ctx.logger;

  // Per-tool override: SAPO_ALLOW_TOOL_<UPPERCASE_NAME>=1
  const envKey = `SAPO_ALLOW_TOOL_${tool.name.toUpperCase()}`;
  if (env[envKey] === '1') {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      tool.handler,
    );
    logger?.debug(`[guard] registered destructive tool via override: ${tool.name}`);
    return true;
  }

  // Wildcard: allow all destructive ops
  if (ctx.allowOps.has('*')) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      tool.handler,
    );
    logger?.debug(`[guard] registered destructive tool via wildcard: ${tool.name}`);
    return true;
  }

  // Category match
  if (ctx.allowOps.has(tool.category)) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      tool.handler,
    );
    logger?.debug(
      `[guard] registered destructive tool via category "${tool.category}": ${tool.name}`,
    );
    return true;
  }

  // Skipped
  logger?.warn(
    `[guard] skipping destructive tool "${tool.name}" (category: ${tool.category}). ` +
      `Add "${tool.category}" to SAPO_ALLOW_OPS to enable.`,
  );
  return false;
}
