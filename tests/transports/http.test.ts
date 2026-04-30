/**
 * Tests for src/transports/http.ts
 *
 * Strategy: spin a real http.Server on an ephemeral port (port=0) and exercise
 * via fetch(). Avoid supertest dep — fetch is built-in on Node 20.
 *
 * The MCP SDK Streamable HTTP transport is mocked at the module boundary so we
 * can drive session lifecycle deterministically without running a full
 * MCP handshake.
 */

import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mock the SDK transport ------------------------------------------------
// vi.mock is hoisted; use vi.hoisted to share the mock class with the factory
// while still letting individual tests inspect instances.
const mockState = vi.hoisted(() => {
  type MockOpts = {
    sessionIdGenerator?: () => string;
    onsessioninitialized?: (id: string) => void | Promise<void>;
    onsessionclosed?: (id: string) => void | Promise<void>;
  };
  const instances: Array<{
    sessionId: string | undefined;
    closeCalls: number;
    handleRequestCalls: number;
    onclose?: () => void;
  }> = [];

  class MockStreamableHTTPServerTransport {
    sessionId: string | undefined;
    closeCalls = 0;
    handleRequestCalls = 0;
    onclose?: () => void;
    onerror?: (e: Error) => void;
    private opts: MockOpts;

    constructor(opts: MockOpts = {}) {
      this.opts = opts;
      instances.push(this);
    }

    async start(): Promise<void> {}

    async handleRequest(
      _req: unknown,
      res: {
        writeHead: (s: number, h?: Record<string, string>) => void;
        end: (b?: string) => void;
        headersSent?: boolean;
      },
    ): Promise<void> {
      this.handleRequestCalls += 1;
      if (!this.sessionId) {
        const gen = this.opts.sessionIdGenerator;
        this.sessionId = gen ? gen() : 'fixed-session';
        await this.opts.onsessioninitialized?.(this.sessionId);
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, session: this.sessionId }));
    }

    async close(): Promise<void> {
      this.closeCalls += 1;
      if (this.sessionId) {
        await this.opts.onsessionclosed?.(this.sessionId);
      }
      this.onclose?.();
    }
  }

  return { instances, MockStreamableHTTPServerTransport };
});

vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: mockState.MockStreamableHTTPServerTransport,
}));

// ---- Imports under test (after mock) --------------------------------------
import type { HttpTransportConfig } from '../../src/config.js';
import type { Logger } from '../../src/logger.js';
import { type RunningHttpTransport, startHttpTransport } from '../../src/transports/http.js';

function silentLogger(): Logger {
  return {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  };
}

function fakeMcpServer() {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReturnType<typeof import('../../src/server.js').createServer>;
}

function baseHttp(overrides: Partial<HttpTransportConfig> = {}): HttpTransportConfig {
  return {
    host: '127.0.0.1',
    port: 0, // ephemeral
    maxSessions: 100,
    sessionIdleMs: 60_000,
    authToken: undefined,
    corsOrigins: [],
    ...overrides,
  };
}

async function startOnEphemeral(
  cfg: Partial<HttpTransportConfig> = {},
  opts: { now?: () => number; modes?: string[] } = {},
): Promise<{ running: RunningHttpTransport; baseUrl: string }> {
  const running = startHttpTransport({
    http: baseHttp(cfg),
    logger: silentLogger(),
    createMcpServer: () => fakeMcpServer(),
    version: '1.2.3',
    modes: opts.modes ?? ['pos-online'],
    now: opts.now,
  });
  // Wait for server.listen callback
  await new Promise<void>((resolve) => {
    if (running.server.listening) resolve();
    else running.server.once('listening', () => resolve());
  });
  const addr = running.server.address() as AddressInfo;
  return { running, baseUrl: `http://127.0.0.1:${addr.port}` };
}

beforeEach(() => {
  mockState.instances.length = 0;
});

afterEach(() => {
  // Safety net — individual tests already shutdown their own server
});

describe('http transport — /health', () => {
  it('GET /health returns 200 with version and modes', async () => {
    const { running, baseUrl } = await startOnEphemeral({}, { modes: ['pos-online', 'web'] });
    try {
      const res = await fetch(`${baseUrl}/health`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.status).toBe('ok');
      expect(body.version).toBe('1.2.3');
      expect(body.modes).toEqual(['pos-online', 'web']);
      expect(body.sessions).toBe(0);
    } finally {
      await running.shutdown();
    }
  });

  it('returns 404 for unknown path', async () => {
    const { running, baseUrl } = await startOnEphemeral();
    try {
      const res = await fetch(`${baseUrl}/nope`);
      expect(res.status).toBe(404);
    } finally {
      await running.shutdown();
    }
  });
});

describe('http transport — /mcp session lifecycle', () => {
  it('creates a new session on first POST /mcp', async () => {
    const { running, baseUrl } = await startOnEphemeral();
    try {
      const res = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; session: string };
      expect(body.ok).toBe(true);
      expect(body.session).toMatch(/^[0-9a-f-]{36}$/);
      expect(running.sessionCount()).toBe(1);
      expect(mockState.instances).toHaveLength(1);
    } finally {
      await running.shutdown();
    }
  });

  it('reuses transport when mcp-session-id matches an existing session', async () => {
    const { running, baseUrl } = await startOnEphemeral();
    try {
      const r1 = await fetch(`${baseUrl}/mcp`, { method: 'POST' });
      const sid = ((await r1.json()) as { session: string }).session;
      const r2 = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: { 'mcp-session-id': sid },
      });
      expect(r2.status).toBe(200);
      // Only one transport instance created
      expect(mockState.instances).toHaveLength(1);
      expect(mockState.instances[0].handleRequestCalls).toBe(2);
    } finally {
      await running.shutdown();
    }
  });

  it('rejects with 503 when maxSessions reached', async () => {
    const { running, baseUrl } = await startOnEphemeral({ maxSessions: 1 });
    try {
      await fetch(`${baseUrl}/mcp`, { method: 'POST' });
      const r2 = await fetch(`${baseUrl}/mcp`, { method: 'POST' });
      expect(r2.status).toBe(503);
      const body = (await r2.json()) as { error: string; limit: number };
      expect(body.error).toBe('max_sessions_exceeded');
      expect(body.limit).toBe(1);
    } finally {
      await running.shutdown();
    }
  });

  it('shutdown closes all open transports', async () => {
    const { running, baseUrl } = await startOnEphemeral();
    await fetch(`${baseUrl}/mcp`, { method: 'POST' });
    await fetch(`${baseUrl}/mcp`, { method: 'POST' });
    expect(running.sessionCount()).toBe(2);
    await running.shutdown();
    expect(mockState.instances.every((t) => t.closeCalls === 1)).toBe(true);
    expect(running.sessionCount()).toBe(0);
  });
});

describe('http transport — bearer auth', () => {
  it('rejects /mcp with 401 when token configured but missing header', async () => {
    const { running, baseUrl } = await startOnEphemeral({ authToken: 'secret' });
    try {
      const res = await fetch(`${baseUrl}/mcp`, { method: 'POST' });
      expect(res.status).toBe(401);
      expect(res.headers.get('www-authenticate')).toBe('Bearer');
    } finally {
      await running.shutdown();
    }
  });

  it('rejects /mcp with 401 when token wrong', async () => {
    const { running, baseUrl } = await startOnEphemeral({ authToken: 'secret' });
    try {
      const res = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: { authorization: 'Bearer wrong' },
      });
      expect(res.status).toBe(401);
    } finally {
      await running.shutdown();
    }
  });

  it('accepts /mcp with correct Bearer token', async () => {
    const { running, baseUrl } = await startOnEphemeral({ authToken: 'secret' });
    try {
      const res = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: { authorization: 'Bearer secret' },
      });
      expect(res.status).toBe(200);
    } finally {
      await running.shutdown();
    }
  });

  it('does not require auth on /health even when token configured', async () => {
    const { running, baseUrl } = await startOnEphemeral({ authToken: 'secret' });
    try {
      const res = await fetch(`${baseUrl}/health`);
      expect(res.status).toBe(200);
    } finally {
      await running.shutdown();
    }
  });
});

describe('http transport — CORS', () => {
  it('does not set CORS headers when corsOrigins is empty', async () => {
    const { running, baseUrl } = await startOnEphemeral();
    try {
      const res = await fetch(`${baseUrl}/health`, { headers: { origin: 'https://x.test' } });
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    } finally {
      await running.shutdown();
    }
  });

  it('echoes allowed origin when listed in corsOrigins', async () => {
    const { running, baseUrl } = await startOnEphemeral({
      corsOrigins: ['https://app.test'],
    });
    try {
      const res = await fetch(`${baseUrl}/health`, {
        headers: { origin: 'https://app.test' },
      });
      expect(res.headers.get('access-control-allow-origin')).toBe('https://app.test');
    } finally {
      await running.shutdown();
    }
  });

  it('answers OPTIONS preflight with 204', async () => {
    const { running, baseUrl } = await startOnEphemeral({
      corsOrigins: ['*'],
    });
    try {
      const res = await fetch(`${baseUrl}/mcp`, {
        method: 'OPTIONS',
        headers: { origin: 'https://x.test' },
      });
      expect(res.status).toBe(204);
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
    } finally {
      await running.shutdown();
    }
  });
});
