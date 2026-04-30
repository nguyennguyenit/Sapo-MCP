# Code Standards & Guidelines

## TypeScript Configuration

**File:** tsconfig.json

| Setting | Value | Reason |
|---------|-------|--------|
| **target** | ES2022 | Modern Node 20+ features |
| **module** | NodeNext | Native ESM support |
| **strict** | true | Type safety |
| **declaration** | true | .d.ts for library consumers |
| **sourceMap** | true | Production debugging |
| **skipLibCheck** | true | Faster builds |
| **esModuleInterop** | true | CJS/ESM compatibility |

## Linter Configuration

**Tool:** Biome v2.4.13

**File:** biome.json

| Rule | Setting | Notes |
|------|---------|-------|
| **Indent** | 2 spaces | Consistency |
| **Line width** | 100 chars | Readability on standard terminals |
| **Quotes** | Single | Consistency |
| **Trailing commas** | Yes | Cleaner diffs |
| **Semicolons** | Yes | Explicit |
| **Recommended rules** | All enabled | Security + best practices |
| **.gitignore aware** | true | Respects .gitignore |

**Run locally:**
```bash
npm run lint
```

## Naming Conventions

### Files & Directories

**Convention:** kebab-case with descriptive names

| Item | Pattern | Example |
|------|---------|---------|
| **Source files** | kebab-case.ts | inventory-write.ts, customer-addresses.ts |
| **Directories** | kebab-case | src/tools/, src/client/ |
| **Test files** | {name}.test.ts | orders.test.ts |
| **Config files** | hyphenated or dotted | biome.json, tsconfig.json, vitest.config.ts |

**Why:** Self-documenting for LLM tools (Grep, Glob) — long filenames acceptable.

### Code Identifiers

| Item | Case | Example |
|------|------|---------|
| **Classes** | PascalCase | `SapoClient`, `SapoError`, `McpServer` |
| **Interfaces** | PascalCase | `SapoConfig`, `SapoResponse`, `Tool` |
| **Types** | PascalCase | `ModeName`, `Transport` |
| **Functions** | camelCase | `createCustomer()`, `buildBasicAuth()`, `parseConfig()` |
| **Constants** | UPPER_SNAKE | `VALID_TRANSPORTS`, `SERVER_VERSION`, `MAX_RETRY` |
| **Variables** | camelCase | `isValid`, `retryCount`, `client` |
| **Zod schemas** | camelCase + Input/Output suffix | `createCustomerInput`, `customerOutput` |
| **Enums** | PascalCase (type), UPPER_SNAKE (values) | `enum Mode { POS_ONLINE = 'pos-online' }` |

### Tool & API Names

| Item | Case | Example |
|------|------|---------|
| **Tool names** | snake_case | `list_customers`, `create_order`, `cancel_order` |
| **Tool categories** | snake_case | `cancel`, `delete`, `delete_strict`, `inventory_set` |
| **API endpoints** | unchanged from Sapo | `/admin/customers.json` |
| **Config env vars** | UPPER_SNAKE | `SAPO_STORE`, `SAPO_API_KEY`, `SAPO_ALLOW_OPS` |

## Tool Descriptions

**Reference:** `docs/tool-description-style.md` (preserved)

### Format Rules

1. **Verb first:** List, Get, Create, Update, Delete, Search, Complete
2. **Concise object:** singular (customer, order, variant)
3. **Optional persona:** `for <role>` when non-obvious
4. **Effect statement:** Include destructive warnings
5. **Length:** 25–300 chars, max 3 sentences
6. **Punctuation:** Period at end; semicolon between sentences

### Examples

**Read (list):**
```typescript
"List all sale orders with optional filters (status, source, date range). Returns paginated results via since_id cursor."
```

**Read (get):**
```typescript
"Get a single customer by ID, including their address list and order count."
```

**Create:**
```typescript
"Create a new draft order for a customer. Non-destructive until completed via complete_draft_order."
```

**Destructive:**
```typescript
"Cancel a sale order. Destructive: requires confirm:true and SAPO_ALLOW_OPS includes 'cancel'. Use for refund or dispute workflows."
```

### Anti-patterns

| Bad | Good |
|-----|------|
| "Cancel order" | "Cancel a sale order. Destructive: requires SAPO_ALLOW_OPS includes 'cancel'." |
| "Get" | "Get a single customer by ID." |
| "List products and stuff" | "List all products with optional filters (status, category, price range)." |
| No persona hint | "List locations for the POS counter. Returns store locations + pickup points." |

### Destructive Tool Template

```typescript
{
  description:
    '<Action> <object>. ' +
    'Destructive: requires SAPO_ALLOW_OPS includes \'<category>\'. ' +
    '<Context: when to use vs alternatives>.'
}
```

**Categories:**
- `cancel` — order cancellation
- `delete` — soft delete (reversible)
- `delete_strict` — hard delete (non-recoverable)
- `inventory_set` — force inventory level
- `shift_close` — pos shift close
- `cashbook_write` — financial write (internal-only, deferred OAuth)

## Parameter & Schema Guidelines

### Zod Describe Patterns

Every field must have `.describe()` answering:
1. What it is (type/format)
2. What happens with it (effect)

**Examples:**

```typescript
// Good
z.string().describe('Sale order ID (numeric string, e.g. "12345"). Required.')
z.boolean().describe('Must be true to confirm the destructive action. Prevents accidental execution.')
z.number().optional().describe('Max results per page (default 20, max 250).')
z.string().email().describe('Customer email address. Used for order notifications.')
z.date().describe('Start date for report (ISO 8601 format, e.g. "2026-04-30").')

// Bad
z.string().describe('ID')
z.boolean()  // No describe
z.number().describe('Limit')  // No default or range
```

### Common Patterns

**IDs (as strings):**
```typescript
id: z.string().describe('Customer ID (numeric string, e.g. "12345")')
```

**Pagination:**
```typescript
since_id: z.string().optional().describe('Cursor: return results after this ID'),
limit: z.number().optional().describe('Results per page (default 20, max 250)'),
```

**Dates (ISO 8601):**
```typescript
created_after: z.string().optional().describe('Start date (ISO 8601, e.g. "2026-04-01")')
```

**Booleans (confirm patterns):**
```typescript
confirm: z.boolean().describe('Must be true to confirm this destructive action.')
```

**Enums:**
```typescript
status: z.enum(['pending', 'completed', 'cancelled']).describe('Order status.')
```

## Code Organization

### Module Structure

**Pattern:** Functional domains over technical layers

```
src/
├── client/           # HTTP client + Sapo API abstraction
├── config.ts         # Env validation
├── guards.ts         # Access control
├── index.ts          # CLI entry
├── logger.ts         # Logging
├── middleware/       # HTTP middleware (auth)
├── modes/            # Tool groups by domain (pos-online, web, etc)
├── schemas/          # Zod I/O validation
├── server.ts         # MCP server factory
├── tools/            # Tool implementations
└── transports/       # I/O (stdio, http)
```

### File Size Management

**Guideline:** Keep source files under 200 lines

| File Type | Max LOC | Split at | Reason |
|-----------|---------|----------|--------|
| **Tool registrars** | 150 | 200 | 1 tool per file risks fragmentation; group related tools |
| **Schemas** | 200 | 300 | Large schema groups (orders, variants) can be domain-driven |
| **Tests** | 250 | 300 | Related test cases grouped |
| **Utilities** | 150 | 200 | E.g. logger.ts, guards.ts |

### When to Modularize

Split a file into multiple when:
1. Different functional domains are mixed
2. File exceeds 200 LOC
3. Logical separation improves readability
4. Same logic is duplicated

**Example:** tools/orders.ts → tools/orders-list.ts, tools/orders-get.ts, tools/orders-create.ts (only if >200 LOC)

## Error Handling

### Error Hierarchy

```typescript
Error (native)
├── SapoError (extends Error)
│   ├── SapoHttpError (status: number, code?: string)
│   └── SapoValidationError (path: string[])
└── SapoNotFoundError (extends SapoHttpError, 404)
```

### Usage in Tools

```typescript
import { handleNotFound } from './tool-response.js';

export async function getTool(input: GetInput) {
  try {
    const response = await client.get(`/customers/${input.id}.json`);
    return okResponse({ data: response.customer });
  } catch (error) {
    if (error instanceof SapoNotFoundError) {
      return handleNotFound(input.id, 'Customer');
    }
    return errResponse(error, error.status || 500);
  }
}
```

### Response Shapes

**Success:**
```typescript
{
  data: T | T[],
  truncated?: boolean  // true if pagination cap hit
}
```

**Error:**
```typescript
{
  error: string,         // Human-readable message
  status_code: number,   // HTTP status
  code?: string          // Internal code (e.g. 'invalid_request')
}
```

**Helper functions (tool-response.ts):**
```typescript
okResponse({ data, truncated?: false })
errResponse(error, statusCode)
handleNotFound(id, resourceType)
```

## Testing Strategy

**Framework:** Vitest 4.1 + MSW v2.14

**Setup:** vitest.config.ts with MSW integration

### Unit Tests
- Test isolated functions (parseModes, buildBasicAuth, etc)
- No HTTP mocks
- Fast execution

### Integration Tests
- Test tool + client interaction
- Mock HTTP via MSW
- Use SAPO_STORE=test env

### Coverage Goals
- Aim for >80% line coverage
- All error paths tested
- Destructive operations guarded
- Pagination edge cases (empty, truncated)

**Run tests:**
```bash
npm run test              # Run all
npm run test -- inventory # Run matching file
npm run test:coverage     # With coverage report
```

## Conventional Commits

**Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation only
- `refactor` — Code restructuring (no feature change)
- `test` — Test additions/updates
- `chore` — Build, deps, config

**Scope (optional):** Feature area (e.g. `orders`, `inventory`, `http`)

**Examples:**
```
feat(orders): add order cancellation with destructive gating
fix(client): respect Retry-After header in exponential backoff
docs: update README for 0.5.0 release
refactor(tools): extract common pagination logic
test(inventory): add edge cases for zero-stock scenarios
chore: upgrade zod to 3.25.0
```

**Rules:**
- No AI references (no "Claude", "AI")
- Lowercase subject
- Imperative mood ("add", not "adds" or "added")
- No period at end of subject
- Focused per commit (not "fix multiple bugs")

## Changesets Workflow

**Tool:** Changesets v2.31

**File structure:**
```
.changeset/
├── config.json               # Version + release config
└── <uuid>-<title>.md        # Per-change entry
```

**Creating a changeset:**
```bash
npm run changeset add
# Answer prompts:
#  - Which packages? (sapo-mcp)
#  - Bump type? (major/minor/patch)
#  - Summary? (40-80 chars)
```

**Changeset format (.md):**
```markdown
---
"sapo-mcp": minor
---

Add HTTP transport for remote MCP clients
```

**Releasing:**
```bash
npm run changeset version    # Updates package.json + CHANGELOG
npm run build                # Compile
npm publish                  # Publish to npm
git tag v0.6.0               # Tag release
```

**Pre-1.0 behavior (0.5.0):**
- Manual version bumps (not yet automated)
- Changesets track intent for future auto-versioning

**Post-0.5.1 behavior:**
- Auto-versioning from changesets
- ci: false to skip tests in pre-1.0 (manual gate)

## Security & PII

### Logging

**Default:** All PII redacted

```typescript
// Logger redacts:
phone: "***" (was: "0912345678")
email: "***" (was: "user@example.com")
name: "***" (was: "John Doe")
address: "***" (was: "123 Main St")
card_number: "***" (was: "4111111...")
Authorization: "Basic ***" (was: "Basic c2FwbzprZXk=")
```

**Opt-in full PII:**
```bash
SAPO_LOG_PII=1 sapo-mcp --mode=pos-online
```

### Secrets

**Best practice:** Use SAPO_API_SECRET_FILE (reads file, not env var)

```bash
# Less secure (visible to ps, /proc)
export SAPO_API_SECRET=mysecret
sapo-mcp --mode=pos-online

# Better (file-only visibility)
echo "mysecret" > /run/secrets/sapo_secret
SAPO_API_SECRET_FILE=/run/secrets/sapo_secret sapo-mcp --mode=pos-online
```

### HTTP Transport

**Loopback (127.0.0.1 / ::1):** Token optional

```bash
sapo-mcp --transport=http --port=3333
# No token required — binds to localhost only
```

**Public (0.0.0.0):** Token required

```bash
SAPO_HTTP_HOST=0.0.0.0 sapo-mcp --transport=http
# ERROR: token required for non-loopback host
# Fix:
SAPO_HTTP_HOST=0.0.0.0 SAPO_MCP_AUTH_TOKEN=$(openssl rand -hex 32) sapo-mcp --transport=http
```

## Code Review Checklist

Before submitting a PR:

- [ ] Types are strict (no `any`)
- [ ] No unused variables or imports
- [ ] Tool descriptions follow style guide
- [ ] Zod schemas have `.describe()` on all fields
- [ ] Error cases tested
- [ ] Destructive tools guarded + confirm: true
- [ ] PII redaction in logs (if applicable)
- [ ] Tests pass: `npm run test`
- [ ] Lint passes: `npm run lint`
- [ ] Type check passes: `npm run typecheck`
- [ ] Commit message follows conventional commits
- [ ] No secrets in code (env vars only)

## Performance & Optimization

### Client Retry Strategy

**Policy:**
- Retry on 5xx, 429 (transient)
- No retry on 401, 404, 422 (client/validation errors)
- Exp backoff: 1s base, 2^attempt multiplier, max 3 attempts
- Respect Retry-After header

**Example:**
```
Attempt 1: immediate
Attempt 2: wait 1s
Attempt 3: wait 2s (then give up)
```

### Pagination

**Auto-pagination cap:** SAPO_MAX_AUTO_PAGES (default: 10)

```typescript
// If pagination exceeds cap, set truncated: true
{
  data: items.slice(0, maxPages * pageSize),
  truncated: true  // Signal to client
}
```

### HTTP Session Management

**Idle GC:** SAPO_HTTP_SESSION_IDLE_MS (default: 30 min)

```typescript
// Sessions evicted if idle for 30 min
// Passive eviction (checked on each request)
// No active timer thread
```

**Concurrent session cap:** SAPO_HTTP_MAX_SESSIONS (default: 100)

```typescript
// If cap hit, return 503 Service Unavailable
if (sessions.size >= maxSessions) {
  return 503;
}
```

## Related Documentation

- **Tool descriptions:** `docs/tool-description-style.md`
- **Architecture:** `docs/system-architecture.md`
- **Deployment:** `docs/deployment-guide.md`
- **Roadmap:** `docs/project-roadmap.md`
- **README:** Quick start, modes, env vars
