# Codebase Summary

## Project Statistics (v0.5.0)

| Metric | Value |
|--------|-------|
| **Total src/ LOC** | 9,091 |
| **TypeScript files** | 40+ |
| **Test files** | 10 |
| **Test cases** | 84 |
| **Zod schemas** | 24 |
| **Modes** | 4 |
| **Tools** | 104 |
| **Build output** | dist/index.mjs (ESM) |

## Directory Structure

```
sapo-mcp/
├── src/
│   ├── index.ts                  # CLI entry, arg parsing, signal handling
│   ├── server.ts                 # McpServer factory, mode wiring
│   ├── config.ts                 # Zod env validation (23 vars)
│   ├── guards.ts                 # registerIfAllowed() for tool gating
│   ├── logger.ts                 # Stderr JSON, PII redaction, 5 levels
│   │
│   ├── client/
│   │   ├── http.ts               # SapoClient: Basic Auth, retry, 30s timeout
│   │   ├── auth.ts               # buildBasicAuth()
│   │   ├── errors.ts             # SapoError, SapoHttpError hierarchy
│   │   ├── pagination.ts         # buildSinceIdCursor()
│   │   ├── sleep.ts              # exp backoff sleep()
│   │   ├── types.ts              # SapoConfig, SapoResponse, etc
│   │   └── ...                   # 9 files total
│   │
│   ├── config.ts                 # Schema definitions for HTTP, SapoClient
│   │
│   ├── middleware/
│   │   └── auth.ts               # checkBearerAuth()
│   │
│   ├── modes/
│   │   ├── registry.ts           # parseModes(), registerModes()
│   │   ├── pos-online.ts         # 48 tools
│   │   ├── web.ts                # 31 tools
│   │   ├── pos-counter.ts        # 15 tools
│   │   └── analytics.ts          # 10 tools
│   │
│   ├── schemas/
│   │   ├── customers.ts          # List/Get/Update customer
│   │   ├── orders.ts             # Order, DraftOrder, Return, Transaction
│   │   ├── inventory.ts          # Inventory read/write
│   │   ├── products.ts           # Product, Variant (read)
│   │   ├── analytics.ts          # Revenue, TopProducts, LTV, etc
│   │   ├── ...                   # 24 files total
│   │   └── common.ts             # Pagination, Pagination, base types
│   │
│   ├── tools/
│   │   ├── orders.ts             # order list/get/create/cancel
│   │   ├── draft-orders.ts       # draft order CRUD
│   │   ├── order-returns.ts      # return list/get/create
│   │   ├── order-transactions.ts # transaction list
│   │   ├── orders-counter.ts     # pos counter orders
│   │   ├── destructive-orders.ts # delete_order (gated)
│   │   ├── inventory-*.ts        # inventory read/write
│   │   ├── products-*.ts         # products read, SEO
│   │   ├── variants-*.ts         # variants read, write, write
│   │   ├── customers.ts          # customer CRUD
│   │   ├── collections.ts        # collection list/get/create/delete
│   │   ├── blogs.ts              # blog CRUD
│   │   ├── articles.ts           # article CRUD
│   │   ├── pages.ts              # page CRUD
│   │   ├── script-tags.ts        # script tag CRUD
│   │   ├── store-info.ts         # get store info
│   │   ├── locations.ts          # location list/get [UNDOCUMENTED]
│   │   ├── payment-methods.ts    # payment method list [UNDOCUMENTED]
│   │   ├── pos-shifts.ts         # shift list/get/close [UNDOCUMENTED]
│   │   ├── suppliers.ts          # supplier list/get [UNDOCUMENTED]
│   │   ├── stock-transfers.ts    # transfer list/get [UNDOCUMENTED]
│   │   ├── price-rules.ts        # price rule CRUD
│   │   ├── discount-codes.ts     # discount CRUD
│   │   ├── analytics.ts          # 10 composed reports
│   │   ├── tool-response.ts      # okResponse(), errResponse(), handleNotFound()
│   │   └── ...                   # 28 files total
│   │
│   └── transports/
│       ├── stdio.ts              # StdioServerTransport wrapper
│       └── http.ts               # StreamableHTTPServerTransport + session mgmt
│
├── tests/
│   ├── integration/
│   │   └── ...                   # ~2.1k LOC, 84 tests
│   └── unit/
│       └── ...
│
├── examples/
│   ├── Dockerfile                # Multi-stage, Node 20 Alpine, non-root
│   └── docker-compose.yml        # Local dev setup
│
├── package.json                  # v0.5.0, engines: node >=20
├── tsconfig.json                 # ES2022, NodeNext ESM, strict
├── biome.json                    # v2.4.13, 2-space, 100 width
├── vitest.config.ts              # Coverage + MSW setup
├── tsup.config.ts                # Single entry, ESM, shebang banner
│
├── README.md                      # (262 lines, preserved)
├── CHANGELOG.md                   # Per-version history
├── LICENSE                        # MIT
└── docs/
    ├── tool-description-style.md # (existing, preserved)
    ├── project-overview-pdr.md   # (this doc)
    ├── codebase-summary.md       # (this doc)
    ├── code-standards.md         # (new)
    ├── system-architecture.md    # (new)
    ├── project-roadmap.md        # (new)
    └── deployment-guide.md       # (new)
```

## Key Modules & Patterns

### 1. Client Module (src/client/)
**Purpose:** HTTP abstraction over Sapo API with retry logic.

- **SapoClient** (http.ts): Basic Auth, exp backoff (1s base, 2^attempt), 3 retries, respects Retry-After, 30s timeout
- **Errors** (errors.ts): SapoError > SapoHttpError, 401/404/422 non-retryable
- **Pagination** (pagination.ts): since_id cursor + max 10 auto-pages (SAPO_MAX_AUTO_PAGES)
- **Patterns:** Singleton per server, dependency injection in modes

### 2. Modes Module (src/modes/)
**Purpose:** Organize tools by functional area; dedup shared tools.

- **registry.ts:** parseModes() validates CSV, calls registrars in order
- **pos-online.ts, web.ts, pos-counter.ts, analytics.ts:** each returns tool definitions
- **Pattern:** Registrar receives (server, client, config) → adds tools via server.tool()

### 3. Tools Module (src/tools/)
**Purpose:** Define MCP tools; handle Sapo API calls & error translation.

**Organization by domain:**
- **Orders:** orders.ts, draft-orders.ts, order-returns.ts, order-transactions.ts, orders-counter.ts
- **Destructive:** destructive-orders.ts, destructive-resources.ts (gated)
- **Inventory:** inventory-readonly.ts, inventory-write.ts
- **Products/Variants:** products-readonly.ts, variants-readonly.ts, variants-write.ts, products-seo.ts
- **Customers:** customers.ts, customer-addresses.ts
- **Collections/Blog:** collections.ts, blogs.ts, articles.ts, pages.ts
- **Web:** script-tags.ts, store-info.ts, locations.ts, payment-methods.ts (4 undocumented)
- **POS Counter:** pos-shifts.ts, suppliers.ts, stock-transfers.ts
- **Pricing:** price-rules.ts, discount-codes.ts
- **Analytics:** analytics.ts (10 composed tools)
- **Helper:** tool-response.ts (okResponse, errResponse, handleNotFound)

**Response Format (tool-response.ts):**
```typescript
okResponse({ data, truncated?: false }) → { data, truncated: false }
errResponse(error, statusCode) → { error: message, status_code, code? }
handleNotFound(id, resource) → 404 with friendly message
```

### 4. Schemas Module (src/schemas/)
**Purpose:** Zod validation for tool inputs/outputs.

- **Organization:** One schema per domain (customers, orders, inventory, analytics, etc)
- **Common patterns:**
  - `.describe()` on every field (type + effect)
  - Numeric IDs as string (e.g., z.string().describe('Customer ID'))
  - Optional pagination (since_id, limit, max auto-pages)
  - Pagination response: `{ data: T[], has_more: boolean, next_cursor?: string }`

### 5. Config Module (src/config.ts)
**Purpose:** Zod-based environment validation; version-managed secrets.

**Environment variables (23 total):**

| Category | Variable | Type | Default | Notes |
|----------|----------|------|---------|-------|
| **Sapo Auth** | SAPO_STORE | string | — | Required |
| | SAPO_API_KEY | string | — | Required |
| | SAPO_API_SECRET | string | — | Required* |
| | SAPO_API_SECRET_FILE | string | — | Overrides SAPO_API_SECRET |
| **Permissions** | SAPO_ALLOW_OPS | CSV | "" | cancel, delete, delete_strict, inventory_set, shift_close, cashbook_write or '*' |
| **Pagination** | SAPO_MAX_AUTO_PAGES | number | 10 | Max auto-page limit |
| **Retry** | SAPO_RETRY_MAX | number | 3 | HTTP retry attempts |
| **Logging** | SAPO_LOG_LEVEL | string | info | error, warn, info, debug, trace |
| | SAPO_LOG_PII | boolean | false | Opt-in full PII logging |
| **HTTP Host** | SAPO_HTTP_HOST | string | 127.0.0.1 | Bind address |
| | SAPO_HTTP_PORT | number | 3333 | Port |
| | SAPO_HTTP_MAX_SESSIONS | number | 100 | Concurrent session cap |
| | SAPO_HTTP_SESSION_IDLE_MS | number | 1800000 | 30 min idle GC |
| | SAPO_MCP_AUTH_TOKEN | string | — | Bearer token (required if host non-loopback) |
| | SAPO_HTTP_CORS_ORIGINS | CSV | — | CORS allow list (off by default) |

### 6. Logger Module (src/logger.ts)
**Purpose:** Stderr-only JSON logging with PII redaction.

**Features:**
- 5 levels: error, warn, info, debug, trace
- JSON format (one per line)
- Recursive PII redaction: phone, email, name, address, card_number → "***"
- Authorization header masked to "Basic ***"
- Opt-in full PII via SAPO_LOG_PII=1
- Child logger per request (context propagation)

### 7. Guards Module (src/guards.ts)
**Purpose:** Validate tool access per environment rules.

**Logic (registerIfAllowed):**
1. Check per-tool override: SAPO_ALLOW_TOOL_<NAME>=1
2. OR allowOps has '*'
3. OR allowOps has tool.category (cancel, delete, delete_strict, inventory_set, shift_close, cashbook_write)
4. Skip tool with warn log if none match

### 8. Transports Module (src/transports/)

**stdio.ts:**
- Wraps StdioServerTransport
- stdout = JSON-RPC channel
- stderr = logger output
- SIGINT/SIGTERM handler for graceful shutdown

**http.ts:**
- StreamableHTTPServerTransport (Express-like)
- **Endpoints:**
  - GET /health → { status, version, modes, sessions }
  - POST /mcp → create session + init JSON-RPC
  - GET /mcp → SSE long-poll for session
  - DELETE /mcp → terminate session
- **Session model:** UUID per client, isolated McpServer instance
- **Security:** Bearer token (optional if loopback, required otherwise), CORS off by default
- **GC:** Passive eviction at SAPO_HTTP_SESSION_IDLE_MS (default 30 min), max 100 sessions → 503 if full

## Zod Schema Patterns

All schemas use consistent patterns:

```typescript
// Example: Customer schema
export const createCustomerInput = z.object({
  name: z.string().describe('Customer full name'),
  email: z.string().email().optional().describe('Email address'),
  phone: z.string().optional().describe('Phone number (E.164 format)'),
});

export const customerOutput = z.object({
  id: z.string().describe('Customer ID'),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  order_count: z.number().describe('Total orders placed'),
  total_spent: z.number().describe('Total revenue from customer'),
});
```

## Error Hierarchy

```
Error (native)
├── SapoError
│   ├── SapoHttpError (status: number, code?: string)
│   └── SapoValidationError (path: string[])
└── SapoNotFoundError (extends SapoHttpError, status: 404)
```

**Usage in tools:**
```typescript
if (error instanceof SapoNotFoundError) {
  return handleNotFound(id, 'Customer');
}
return errResponse(error, status_code);
```

## Tool Response Format

All tools return consistent shapes:

**Success:**
```typescript
{
  data: T | T[],
  truncated?: boolean,  // true if SAPO_MAX_AUTO_PAGES limit hit
}
```

**Error:**
```typescript
{
  error: string,         // Human-readable message
  status_code: number,   // HTTP status from Sapo API
  code?: string,         // Internal error code (e.g., 'invalid_request')
}
```

## Test Coverage

| Category | Files | Tests | Framework |
|----------|-------|-------|-----------|
| **Unit** | 5 | 30 | Vitest 4.1 |
| **Integration** | 5 | 54 | Vitest + MSW |
| **Coverage** | — | — | @vitest/coverage-v8 |
| **HTTP Mocks** | — | — | MSW v2.14.2 |

**Setup:** vitest.config.ts with MSW integration; SAPO_STORE=test env isolation.

## Naming Conventions

| Item | Case | Example |
|------|------|---------|
| **Files** | kebab-case | inventory-write.ts, customer-addresses.ts |
| **Directories** | kebab-case | src/tools/, src/client/ |
| **Classes** | PascalCase | SapoClient, SapoError |
| **Functions** | camelCase | createCustomer(), buildBasicAuth() |
| **Constants** | UPPER_SNAKE | VALID_TRANSPORTS, SERVER_VERSION |
| **Types/Interfaces** | PascalCase | SapoConfig, SapoResponse |
| **Zod exports** | camelCase + Input/Output | createCustomerInput, customerOutput |
| **Tool names** | snake_case | list_customers, create_order |

## Tool Description Style

See `docs/tool-description-style.md` (preserved).

**Short template:**
```
<Verb> <object> [for <persona>]. <effect/safety note>.
```

**Destructive template:**
```
<Action> <object>. Destructive: requires SAPO_ALLOW_OPS includes '<category>'. <When to use>.
```

**Length:** 25–300 chars, max 3 sentences.

## Build & Release

**Build (tsup):**
- Entry: src/index.ts
- Output: dist/index.mjs (ESM)
- Shebang: injected via tsup banner
- Externals: @modelcontextprotocol/sdk, zod
- Source maps: enabled

**Package metadata (package.json):**
- bin: sapo-mcp → dist/index.mjs
- exports: "." → dist/index.mjs
- files: dist/, README.md, LICENSE, CHANGELOG.md
- type: module (ESM)
- engines: node >=20.0.0

**Publish:**
- npm publish --provenance --access public (granular NPM_TOKEN)
- Changesets v2 for version tracking
- Manual bumps until 0.5.1; auto after

## Linting & Type Checking

**TypeScript Config (tsconfig.json):**
- Target: ES2022
- Module: NodeNext (ESM)
- Strict mode enabled
- Declaration + source maps enabled

**Biome (v2.4.13):**
- 2-space indent
- 100-char line width
- Single quotes
- Trailing commas
- Recommended rule set
- .gitignore aware

**Conventional Commits:**
- feat, fix, docs, chore, refactor, test
- No AI references in messages
- Focused commits per change
