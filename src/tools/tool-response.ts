/**
 * Shared utilities for MCP tool handler responses.
 * Provides consistent response format across all tools.
 */

import { SapoNotFoundError } from '../client/errors.js';

/** Standard success response for MCP tools */
export function okResponse(data: unknown): {
  content: Array<{ type: 'text'; text: string }>;
} {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

/** Standard error response for MCP tools */
export function errResponse(message: string): {
  isError: true;
  content: Array<{ type: 'text'; text: string }>;
} {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

/** Wraps a handler to catch SapoNotFoundError and return a friendly isError response */
export async function handleNotFound<T>(
  fn: () => Promise<T>,
  resourceLabel: string,
): Promise<T | { isError: true; content: Array<{ type: 'text'; text: string }> }> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof SapoNotFoundError) {
      return errResponse(`${resourceLabel} not found.`);
    }
    throw err;
  }
}
