/**
 * Streamable HTTP transport for sapo-mcp.
 *
 * Endpoints:
 *   GET  /health  — liveness probe { status, version, modes }
 *   POST /mcp     — JSON-RPC over Streamable HTTP (creates session on initialize)
 *   GET  /mcp     — long-poll SSE stream for an existing session
 *   DELETE /mcp   — terminate session
 *
 * Single-tenant: credentials sourced from process ENV. Sessions are isolated
 * StreamableHTTPServerTransport instances each connected to a fresh McpServer.
 */

import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { HttpTransportConfig } from '../config.js';
import type { Logger } from '../logger.js';
import { checkBearerAuth } from '../middleware/auth.js';

export interface HttpTransportOptions {
  http: HttpTransportConfig;
  logger: Logger;
  /** Factory invoked per session to produce a fresh McpServer. */
  createMcpServer: () => McpServer;
  /** Server build version (for /health response). */
  version: string;
  /** Modes registered (for /health response). */
  modes: readonly string[];
  /**
   * Override `Date.now` for tests. Defaults to wall-clock.
   */
  now?: () => number;
}

export interface RunningHttpTransport {
  server: Server;
  /** Stop accepting new connections, close active sessions, await server.close(). */
  shutdown: () => Promise<void>;
  /** Number of open sessions (for tests). */
  sessionCount: () => number;
}

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  mcp: McpServer;
  lastActivity: number;
}

const SESSION_HEADER = 'mcp-session-id';

export function startHttpTransport(opts: HttpTransportOptions): RunningHttpTransport {
  const { http, logger, createMcpServer, version, modes } = opts;
  const now = opts.now ?? (() => Date.now());

  const sessions = new Map<string, SessionEntry>();
  let gcTimer: NodeJS.Timeout | undefined;

  function applyCors(req: IncomingMessage, res: ServerResponse): void {
    if (http.corsOrigins.length === 0) return;
    const origin = req.headers.origin;
    const allowAll = http.corsOrigins.includes('*');
    if (origin && (allowAll || http.corsOrigins.includes(origin))) {
      res.setHeader('access-control-allow-origin', allowAll ? '*' : origin);
      res.setHeader('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader(
        'access-control-allow-headers',
        `content-type, authorization, ${SESSION_HEADER}, mcp-protocol-version`,
      );
      res.setHeader('access-control-expose-headers', SESSION_HEADER);
    }
  }

  function writeJson(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  }

  async function handleHealth(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    writeJson(res, 200, {
      status: 'ok',
      version,
      modes,
      sessions: sessions.size,
    });
  }

  async function ensureSession(sessionId: string | undefined): Promise<SessionEntry | null> {
    if (sessionId) {
      const existing = sessions.get(sessionId);
      if (existing) {
        existing.lastActivity = now();
        return existing;
      }
      // Unknown session id — let SDK reject with 404
    }

    if (sessions.size >= http.maxSessions) {
      return null;
    }

    const mcp = createMcpServer();
    const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, { transport, mcp, lastActivity: now() });
        logger.info('http session opened', { sessionId: id, count: sessions.size });
      },
      onsessionclosed: (id) => {
        sessions.delete(id);
        logger.info('http session closed', { sessionId: id, count: sessions.size });
      },
    });
    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid && sessions.has(sid)) {
        sessions.delete(sid);
        logger.info('http session transport closed', { sessionId: sid, count: sessions.size });
      }
    };
    await mcp.connect(transport);
    return { transport, mcp, lastActivity: now() };
  }

  async function handleMcp(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const auth = checkBearerAuth(req, http.authToken);
    if (!auth.ok) {
      res.setHeader('www-authenticate', 'Bearer');
      writeJson(res, 401, { error: 'unauthorized', reason: auth.reason });
      return;
    }

    const sessionHeader = req.headers[SESSION_HEADER];
    const sessionId = Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader;

    const entry = await ensureSession(sessionId);
    if (!entry) {
      writeJson(res, 503, { error: 'max_sessions_exceeded', limit: http.maxSessions });
      return;
    }

    try {
      await entry.transport.handleRequest(req, res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('http /mcp handler error', { error: msg });
      if (!res.headersSent) writeJson(res, 500, { error: 'internal_error' });
    }
  }

  const server = createServer((req, res) => {
    applyCors(req, res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url ?? '/';
    const path = url.split('?')[0];

    if (req.method === 'GET' && path === '/health') {
      void handleHealth(req, res);
      return;
    }

    if (path === '/mcp') {
      void handleMcp(req, res);
      return;
    }

    writeJson(res, 404, { error: 'not_found', path });
  });

  // Session idle GC — sweep at half the idle interval, min 30s, max 5min.
  const sweepMs = Math.min(Math.max(Math.floor(http.sessionIdleMs / 2), 30_000), 300_000);
  gcTimer = setInterval(() => {
    const cutoff = now() - http.sessionIdleMs;
    for (const [id, entry] of sessions) {
      if (entry.lastActivity < cutoff) {
        logger.info('http session evicted (idle)', { sessionId: id });
        void entry.transport.close().catch(() => {});
        sessions.delete(id);
      }
    }
  }, sweepMs);
  // Don't keep the event loop alive solely for the sweep.
  if (typeof gcTimer.unref === 'function') gcTimer.unref();

  server.listen(http.port, http.host, () => {
    logger.info('sapo-mcp http transport listening', {
      host: http.host,
      port: http.port,
      maxSessions: http.maxSessions,
      authToken: http.authToken ? 'configured' : 'none',
      cors: http.corsOrigins,
    });
  });

  async function shutdown(): Promise<void> {
    if (gcTimer) {
      clearInterval(gcTimer);
      gcTimer = undefined;
    }
    server.close();
    const closes: Promise<void>[] = [];
    for (const [, entry] of sessions) {
      closes.push(entry.transport.close().catch(() => {}));
    }
    sessions.clear();
    await Promise.all(closes);
    await new Promise<void>((resolve) => {
      if (!server.listening) {
        resolve();
        return;
      }
      server.once('close', () => resolve());
    });
  }

  return {
    server,
    shutdown,
    sessionCount: () => sessions.size,
  };
}
