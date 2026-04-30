# System Architecture

## Overview

sapo-mcp is an MCP server bridging AI agents and the Sapo.vn API via two transports (stdio, HTTP). Single-tenant, single-store per instance, gated destructive operations.

```
┌─────────────────────────────────────────────────────────────────┐
│ Claude Desktop / Cursor / GoClaw (MCP Client)                   │
└──────────────────────┬──────────────────────────────────────────┘
                       │ (JSON-RPC 2.0)
        ┌──────────────┴─────────────────┐
        │                                │
    stdio                             HTTP
  (pipe)                        (Streamable HTTP)
        │                                │
┌───────▼────────────────────────────────▼───────────┐
│  Transport Layer                                    │
│  ┌──────────┐              ┌──────────────────┐    │
│  │ Stdio    │              │ Streamable HTTP  │    │
│  │ Transport│              │ Transport        │    │
│  └────┬─────┘              └────────┬─────────┘    │
│       │                            │               │
│       │ Session = local stdio      │ Session = UUID│
│       │                            │  per client   │
└───────┼────────────────────────────┼───────────────┘
        │                            │
        └──────────────┬─────────────┘
                       │
        ┌──────────────▼──────────────┐
        │ Middleware (Auth)           │
        │ checkBearerAuth()           │
        │ (no-op if no token)         │
        └──────────────┬──────────────┘
                       │
        ┌──────────────▼──────────────┐
        │ McpServer                   │
        │ name: sapo-mcp              │
        │ version: 0.6.0              │
        │                             │
        │ Tools (105 unique):         │
        │ ├─ pos-online (51)          │
        │ ├─ web (31)                 │
        │ ├─ pos-counter (15)         │
        │ ├─ analytics (10)           │
        │ └─ shared: 2 tools          │
        └──────────────┬──────────────┘
                       │
        ┌──────────────▼──────────────┐
        │ Guards (registerIfAllowed)  │
        │ Per-tool access gating      │
        │ SAPO_ALLOW_OPS + overrides  │
        └──────────────┬──────────────┘
                       │
        ┌──────────────▼──────────────┐
        │ Modes (4 registrars)        │
        │ ├─ pos-online.ts            │
        │ ├─ web.ts                   │
        │ ├─ pos-counter.ts           │
        │ └─ analytics.ts             │
        │                             │
        │ Each returns tool defs      │
        │ Shared tools deduped        │
        └──────────────┬──────────────┘
                       │
        ┌──────────────▼──────────────┐
        │ SapoClient (HTTP)           │
        │ ├─ Basic Auth               │
        │ ├─ Retry logic              │
        │ ├─ Pagination               │
        │ ├─ 30s timeout              │
        │ └─ PII logging + redaction  │
        └──────────────┬──────────────┘
                       │
        ┌──────────────▼──────────────┐
        │ Sapo API                    │
        │ https://{store}.mysapo.net/ │
        │ /admin/{resource}.json      │
        └─────────────────────────────┘
```

## Component Breakdown

### 1. CLI Entry (src/index.ts)

**Responsibilities:**
- Parse CLI flags (--mode, --transport, --port, --help, --version)
- Load + validate environment (Zod config)
- Create McpServer + transport
- Handle SIGINT/SIGTERM gracefully
- Route to appropriate transport

**Flow:**
```
CLI args → parseArgs() → loadConfig() → selectTransport()
           ↓ (stdio)              ↓ (http)
         connectStdio()       startHttpTransport()
           ↓                      ↓
        McpServer           McpServer + Express
           ↓                      ↓
        Process handles      HTTP listening
        JSON-RPC pipes         (port 3333)
```

**Key flags:**
```bash
sapo-mcp --mode=pos-online,web --transport=http --port=3333 --help --version
```

### 2. Server Factory (src/server.ts)

**Responsibility:** Create McpServer, wire SapoClient + modes.

```typescript
export function createServer(opts: ServerCreateOptions): McpServer {
  const server = new McpServer({
    name: 'sapo-mcp',
    version: '0.6.0'  // SERVER_VERSION
  });
  
  const client = new SapoClient({
    store: opts.config.store,
    apiKey: opts.config.apiKey,
    apiSecret: opts.config.apiSecret,
    retryMax: opts.config.retryMax
  });
  
  registerModes(server, client, opts.config);
  return server;
}
```

### 3. Configuration (src/config.ts)

**Responsibility:** Zod-based env validation, precedence rules.

**Key precedence:**
- SAPO_API_SECRET_FILE overrides SAPO_API_SECRET
- SAPO_HTTP_HOST non-loopback requires SAPO_MCP_AUTH_TOKEN
- SAPO_ALLOW_OPS controls destructive categories

**Export:** SapoConfig interface

```typescript
interface SapoConfig {
  store: string;
  apiKey: string;
  apiSecret: string;
  allowOps: string[];        // parsed from CSV
  maxAutoPages: number;      // default 10
  retryMax: number;          // default 3
  logLevel: LogLevel;        // default 'info'
  logPii: boolean;           // default false
  http?: HttpConfig;         // for --transport=http
}
```

### 4. Middleware & Guards

**Auth (src/middleware/auth.ts):**
- checkBearerAuth(token?) → void or throws
- No-op if no token configured
- Validates Bearer prefix + token match

**Guards (src/guards.ts):**
- registerIfAllowed(tool, allowOps, config) → boolean
- Checks per-tool override: SAPO_ALLOW_TOOL_<NAME>=1
- OR allowOps has '*'
- OR allowOps has tool.category (cancel, delete, delete_strict, inventory_set, shift_close, cashbook_write, refund)
- Skipped tools logged at warn level

### 5. Modes Registry (src/modes/)

**registry.ts:**
```typescript
export type ModeName = 'pos-online' | 'web' | 'pos-counter' | 'analytics';

export function parseModes(input: string): ModeName[] {
  // Parse CSV, validate, dedup, return ordered array
}

export function registerModes(server, client, config) {
  // For each mode, call registrar:
  // registerPosOnlineTools(server, client, config)
  // registerWebTools(server, client, config)
  // registerPosCounerTools(server, client, config)
  // registerAnalyticsTools(server, client, config)
}
```

**Per-mode registrar (e.g., pos-online.ts):**
```typescript
export function registerPosOnlineTools(server, client, config) {
  server.tool('list_orders', { ... }, async (input) => {
    // Fetch, paginate, return
  });
  
  server.tool('cancel_order', { ... }, async (input) => {
    // Guard check
    if (!registerIfAllowed('cancel_order', config.allowOps)) {
      return { error: 'Not allowed' };
    }
    // Require confirm: true
    if (!input.confirm) {
      return { error: 'confirm: true required' };
    }
    // Call SapoClient
  });
}
```

**Tool deduplication:**
- Shared tools (e.g., variants_readonly) registered once per mode
- Later modes skip if already registered

### 6. SapoClient (src/client/)

**http.ts (main):**
```typescript
export class SapoClient {
  constructor(opts: {
    store: string,
    apiKey: string,
    apiSecret: string,
    retryMax: number
  }) {
    this.baseUrl = `https://${store}.mysapo.net/admin`;
    this.auth = buildBasicAuth(apiKey, apiSecret);
  }
  
  async get(path: string) { ... }  // GET + pagination support
  async post(path: string, body) { ... }
  async put(path: string, body) { ... }
  async delete(path: string) { ... }
}
```

**Key features:**
- **Auth:** Basic Auth header: `Authorization: Basic base64(key:secret)`
- **Retry:** Exp backoff (1s, 2s, 4s), max 3 attempts, respects Retry-After
- **Non-retryable:** 401 (auth failed), 404 (not found), 422 (validation)
- **Timeout:** 30s hardcoded
- **Pagination:** Since_id cursor, auto-page up to SAPO_MAX_AUTO_PAGES
- **Response:** Parsed JSON or {} on 204 No Content
- **Errors:** Throws SapoHttpError with status + code

**Error hierarchy:**
```typescript
SapoError
├── SapoHttpError { status: number, code?: string }
└── SapoNotFoundError { status: 404 }
```

### 7. Tools Module (src/tools/)

**Tool lifecycle:**
```
Input (MCP tool args)
    ↓ [Zod validation]
Tool implementation function
    ↓ [SapoClient.get/post/put/delete]
Sapo API response
    ↓ [Error handling]
okResponse({ data }) or errResponse(error)
    ↓
MCP client
```

**Helper: tool-response.ts**
```typescript
okResponse({ data, truncated?: false })
  → { data, truncated: false }

errResponse(error, statusCode)
  → { error: message, status_code, code? }

handleNotFound(id, resource)
  → { error: "Customer 12345 not found", status_code: 404 }
```

**Tool response format (all tools):**
```typescript
type ToolResponse = 
  | { data: T | T[], truncated?: boolean }
  | { error: string, status_code: number, code?: string }
```

### 8. Logger (src/logger.ts)

**Output:** Stderr (JSON, one per line)

**Levels:** error, warn, info, debug, trace

**Features:**
- JSON format with timestamp, level, message, context
- Recursive PII redaction (phone, email, name, address, card_number → "***")
- Authorization header masked to "Basic ***"
- Opt-in full PII via SAPO_LOG_PII=1
- Child logger per request (context propagation)

**Example (redacted):**
```json
{
  "timestamp": "2026-04-30T12:34:56Z",
  "level": "info",
  "message": "Tool execution",
  "tool": "create_customer",
  "input": {
    "name": "***",
    "email": "***",
    "phone": "***"
  }
}
```

### 9. Transports

#### Stdio (src/transports/stdio.ts)

```
MCP Client ←→ (stdout/stdin) ←→ Stdio Transport
                                    ↓
                              McpServer
                                    ↓
                              Tool execution
                                    ↓
                           stderr (JSON logs)
```

**Model:**
- Each process instance = 1 session (local, implicit)
- stdout = JSON-RPC channel (must be clean)
- stderr = logger output only
- SIGINT/SIGTERM → graceful shutdown

#### HTTP (src/transports/http.ts)

```
MCP Client ①    MCP Client ②    MCP Client ③
    ↓               ↓               ↓
POST /mcp      POST /mcp       POST /mcp
(init)          (init)          (init)
    ↓               ↓               ↓
Session A       Session B       Session C
(UUID)          (UUID)          (UUID)
    ↓               ↓               ↓
McpServer ①    McpServer ②    McpServer ③
(isolated)      (isolated)      (isolated)
    ↓               ↓               ↓
Tool exec       Tool exec       Tool exec
    ↓               ↓               ↓
GET /mcp        GET /mcp        GET /mcp
(SSE long-poll) (SSE long-poll) (SSE long-poll)
```

**Endpoints:**

| Method | Path | Purpose | Session? |
|--------|------|---------|----------|
| GET | /health | Liveness probe | No |
| POST | /mcp | Initialize + JSON-RPC | Create |
| GET | /mcp | SSE long-poll | Existing (header) |
| DELETE | /mcp | Terminate | Existing (header) |

**Session model:**
- UUID per client (generated on POST /mcp)
- Isolated McpServer per session
- Header: mcp-session-id
- Idle GC: 30 min (passive)
- Max 100 concurrent → 503 if full

**Security:**
- Loopback (127.0.0.1, ::1) → token optional
- Non-loopback (0.0.0.0) → token required or refuse to start
- CORS off by default, enable per-origin via SAPO_HTTP_CORS_ORIGINS

## Data Flow: Tool Call

```
1. MCP Client sends tool call
   {
     "method": "tools/call",
     "params": {
       "name": "list_orders",
       "arguments": { "status": "completed", "limit": 20 }
     }
   }

2. Transport decodes + routes to McpServer

3. McpServer finds tool handler

4. Handler validation (Zod):
   input → listOrdersInput.parse(arguments)
   ↓ (error → toolResponse with error)

5. Guard check:
   registerIfAllowed('list_orders', config.allowOps)
   ↓ (denied → { error: 'Not allowed' })

6. SapoClient call:
   client.get('/admin/orders.json?status=completed&limit=20')
   ↓ (Retry on 5xx, 429; throw on 401/404/422)

7. Sapo API response:
   {
     "orders": [ { id, name, ... }, ... ],
     "pagination": { has_more, next_cursor }
   }

8. Handler processes:
   - If has_more && auto-page < MAX:
     Loop: next call with since_id = next_cursor
   - If auto-page >= MAX:
     Set truncated: true

9. Tool response (okResponse):
   {
     "data": [
       { id: "12345", name: "Order 1", ... },
       ...
     ],
     "truncated": false
   }

10. Transport encodes + sends to client:
    {
      "result": {
        "content": [
          {
            "type": "text",
            "text": "{\"data\": [...], \"truncated\": false}"
          }
        ]
      }
    }
```

## Error Handling

**Flow:**
```
SapoClient.get() → Sapo API response
                      ↓
                   if 5xx/429:
                      Retry with backoff
                   if 401/404/422:
                      Throw SapoHttpError
                   if 2xx:
                      Return parsed JSON
                      ↓
Tool handler
    ↓
if error instanceof SapoNotFoundError:
    handleNotFound(id, resource)
    → { error: "Customer 12345 not found", status_code: 404 }
else:
    errResponse(error, status)
    → { error: "...", status_code: 500, code?: "..." }
```

## Destructive Operation Flow

```
Tool input:
{
  "order_id": "12345",
  "confirm": true  ← Must be explicitly true
}

Guard check:
registerIfAllowed('cancel_order', config.allowOps)
  ↓
  1. SAPO_ALLOW_TOOL_CANCEL_ORDER=1 ? yes → allow
  2. SAPO_ALLOW_OPS includes '*' ? yes → allow
  3. SAPO_ALLOW_OPS includes 'cancel' ? yes → allow
  4. None match → deny + log warning

Confirm check (in handler):
if (!input.confirm) {
  return { error: 'confirm: true required' }
}

SapoClient.delete('/admin/orders/12345.json')
  ↓
Sapo API processes deletion
  ↓
Response: 200 OK or error
```

## Session Model (HTTP Transport)

**Creation:**
```
POST /mcp
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": { ... }
}
→ 200 OK
← mcp-session-id: <UUID>
← McpServer instance created + stored
```

**Usage:**
```
GET /mcp
← (header) mcp-session-id: <UUID>
← SSE stream receives tool responses
```

**Termination (explicit):**
```
DELETE /mcp
(header) mcp-session-id: <UUID>
→ 200 OK
← McpServer cleaned up
```

**Passive GC (idle):**
```
If session.lastActivity < now - 30min:
  Evict at next request
  → client reconnect needed
```

## Modules & Dependencies

### External
- **@modelcontextprotocol/sdk:** MCP spec implementation
- **zod:** Runtime type validation + schema generation

### Internal
- **src/client:** HTTP abstraction
- **src/config:** Env validation
- **src/logger:** Structured logging
- **src/guards:** Access control
- **src/schemas:** Tool I/O validation
- **src/tools:** Tool implementations (104)
- **src/modes:** Tool registrars (4)
- **src/transports:** I/O (stdio, http)
- **src/middleware:** Auth middleware

## Deployment Models

### CLI (Local)
```bash
sapo-mcp --mode=pos-online --transport=stdio
# stdout = JSON-RPC
# stderr = logs
# stdin = JSON-RPC input
```

### Server (Remote)
```bash
SAPO_HTTP_HOST=0.0.0.0 sapo-mcp --transport=http --port=3333
# POST /mcp → initialize session
# GET /mcp → SSE stream
# DELETE /mcp → clean up
```

### Docker (Production)
```bash
docker run -p 3333:3333 \
  -e SAPO_STORE=mystore \
  -e SAPO_API_KEY=xxx \
  -e SAPO_API_SECRET=yyy \
  -e SAPO_HTTP_HOST=0.0.0.0 \
  -e SAPO_MCP_AUTH_TOKEN=<token> \
  sapo-mcp:latest
```

## Schema Drift Detection (Canary CI)

**Purpose:** Nightly automated validation that Sapo API endpoint schemas haven't changed.

**Implementation:** `.github/workflows/canary.yml` + `scripts/canary.ts`

**Probe matrix (12 endpoints):**
- Customers, Orders, Refunds, Products, Variants, Collections, Blogs, Articles, Pages, Store info, Locations, Inventory

**Process:**
1. Daily 2AM UTC (manual dispatch available)
2. Fetch each endpoint + parse with Zod schema (same as tools use)
3. safeParse failure = schema regression (required field changed, type mismatch)
4. Schemas use .passthrough() — additive Sapo changes don't false-positive
5. Exit code: 0=ok, 2=auth_fail, 3=schema_drift, 1=fatal
6. On non-zero: file GitHub Issue with diff report

**Known exclusions:**
- `/admin/pos_shifts.json` — returns text/html (Sapo POS web shell), not JSON

**Discovered issues (2026-04-30):**
- PageSchema.modified_on must be nullable (fixed in 0.6.0)
- pos_shifts endpoint non-functional (excluded from matrix)

## Scaling Considerations (Out of Scope for 0.6.0)

- **Single instance:** No k8s/clustering guidance
- **Session limits:** 100 max concurrent (memory + FD bound)
- **Rate limiting:** None (Sapo API limit: 429 retry only)
- **Session persistence:** None (ephemeral, in-memory)

## Related Files

- **Architecture decisions:** See CLAUDE.md (global rules)
- **Code standards:** docs/code-standards.md
- **Tool descriptions:** docs/tool-description-style.md (preserved)
- **Deployment:** docs/deployment-guide.md
