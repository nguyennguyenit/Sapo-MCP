/**
 * Tests for src/transports/stdio.ts
 * Covers: StdioServerTransport instantiated, server.connect called, logger info emitted
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '../../src/logger.js';
import { connectStdio } from '../../src/transports/stdio.js';

// Mock the MCP SDK stdio transport module
vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  // Must use a function (not arrow) so it can be used as a constructor with `new`
  function MockTransport(this: object) {
    // biome-ignore lint/complexity/useLiteralKeys: bracket notation needed for Record<string,unknown> type
    (this as Record<string, unknown>)['_tag'] = 'StdioServerTransport';
  }
  const mock = vi.fn().mockImplementation(function (this: object) {
    MockTransport.call(this);
  });
  return { StdioServerTransport: mock };
});

function makeLogger(): Logger & { infoMessages: string[] } {
  const infoMessages: string[] = [];
  return {
    infoMessages,
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn((msg: string) => {
      infoMessages.push(msg);
    }),
    debug: vi.fn(),
    trace: vi.fn(),
  };
}

function makeServer() {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
  };
}

describe('connectStdio', () => {
  it('calls server.connect with a StdioServerTransport instance', async () => {
    const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
    const server = makeServer();
    const logger = makeLogger();

    // biome-ignore lint/suspicious/noExplicitAny: test double
    await connectStdio(server as any, logger);

    expect(StdioServerTransport).toHaveBeenCalledOnce();
    expect(server.connect).toHaveBeenCalledOnce();

    // Verify connect received the transport instance
    const transportInstance = (StdioServerTransport as ReturnType<typeof vi.fn>).mock.results[0]
      ?.value;
    expect(server.connect).toHaveBeenCalledWith(transportInstance);
  });

  it('logs "sapo-mcp running on stdio" after connect', async () => {
    const server = makeServer();
    const logger = makeLogger();

    // biome-ignore lint/suspicious/noExplicitAny: test double
    await connectStdio(server as any, logger);

    expect(logger.infoMessages).toContain('sapo-mcp running on stdio');
  });

  it('propagates error if server.connect rejects', async () => {
    const server = makeServer();
    server.connect.mockRejectedValue(new Error('connect failed'));
    const logger = makeLogger();

    // biome-ignore lint/suspicious/noExplicitAny: test double
    await expect(connectStdio(server as any, logger)).rejects.toThrow('connect failed');
  });

  it('does not log before connect resolves', async () => {
    let resolveConnect!: () => void;
    const server = {
      connect: vi.fn().mockReturnValue(
        new Promise<void>((res) => {
          resolveConnect = res;
        }),
      ),
    };
    const logger = makeLogger();

    // biome-ignore lint/suspicious/noExplicitAny: test double
    const promise = connectStdio(server as any, logger);
    expect(logger.infoMessages).toHaveLength(0);

    resolveConnect();
    await promise;
    expect(logger.infoMessages).toHaveLength(1);
  });
});
