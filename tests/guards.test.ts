/**
 * Tests for src/guards.ts — registerIfAllowed
 * Covers: non-destructive registration, destructive skip, category allow, wildcard, per-tool override
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { DestructiveToolDef } from '../src/guards.js';
import { registerIfAllowed } from '../src/guards.js';
import type { Logger } from '../src/logger.js';

function makeServer(): McpServer {
  return new McpServer({ name: 'test', version: '0.0.0' });
}

function makeLogger(): Logger {
  return {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  };
}

const confirmSchema = { confirm: z.boolean().describe('Must be true to confirm') };

const dummyTool: DestructiveToolDef<typeof confirmSchema> = {
  name: 'cancel_order',
  category: 'cancel',
  description: 'Cancel a sale order. Destructive: requires SAPO_ALLOW_OPS includes cancel.',
  inputSchema: confirmSchema,
  handler: async () => ({ content: [{ type: 'text' as const, text: 'cancelled' }] }),
};

describe('registerIfAllowed', () => {
  let server: McpServer;
  let logger: Logger;

  beforeEach(() => {
    server = makeServer();
    logger = makeLogger();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips and warns when allowOps is empty', () => {
    const registered = registerIfAllowed(server, dummyTool, {
      allowOps: new Set(),
      logger,
    });
    expect(registered).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('cancel_order'));
  });

  it('registers when allowOps has matching category', () => {
    const registered = registerIfAllowed(server, dummyTool, {
      allowOps: new Set(['cancel']),
      logger,
    });
    expect(registered).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('registers when allowOps has wildcard "*"', () => {
    const registered = registerIfAllowed(server, dummyTool, {
      allowOps: new Set(['*']),
      logger,
    });
    expect(registered).toBe(true);
  });

  it('skips when allowOps has different category', () => {
    const registered = registerIfAllowed(server, dummyTool, {
      allowOps: new Set(['delete']),
      logger,
    });
    expect(registered).toBe(false);
  });

  it('registers via per-tool override SAPO_ALLOW_TOOL_<NAME>=1', () => {
    const registered = registerIfAllowed(server, dummyTool, {
      allowOps: new Set(),
      env: { SAPO_ALLOW_TOOL_CANCEL_ORDER: '1' },
      logger,
    });
    expect(registered).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('override'));
  });

  it('does not register via per-tool override when value is "0"', () => {
    const registered = registerIfAllowed(server, dummyTool, {
      allowOps: new Set(),
      env: { SAPO_ALLOW_TOOL_CANCEL_ORDER: '0' },
      logger,
    });
    expect(registered).toBe(false);
  });

  it('registers delete_strict category tool when allowed', () => {
    const idSchema = { id: z.string().describe('Customer ID') };
    const deleteTool: DestructiveToolDef<typeof idSchema> = {
      name: 'hard_delete_customer',
      category: 'delete_strict',
      description: 'Permanently delete a customer. Destructive.',
      inputSchema: idSchema,
      handler: async () => ({ content: [{ type: 'text' as const, text: 'deleted' }] }),
    };

    const registered = registerIfAllowed(server, deleteTool, {
      allowOps: new Set(['delete_strict']),
      logger,
    });
    expect(registered).toBe(true);
  });

  it('warns with category name in message', () => {
    registerIfAllowed(server, dummyTool, {
      allowOps: new Set(),
      logger,
    });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('cancel'));
  });
});
