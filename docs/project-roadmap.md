# Project Roadmap

## Release History

| Version | Date | Status | Highlights |
|---------|------|--------|-----------|
| **0.5.0** | 2026-04-30 | ✅ Released | 4 modes, 104 tools, 2 transports, pre-1.0 |
| 0.1.0 | — | — | (Phase 5 milestone) |

## Current Status (0.5.0)

- **Release Date:** 2026-04-30
- **Status:** Stable, production-ready for single-tenant Private App use
- **Tool Coverage:** 104 tools across 4 modes (pos-online 48, web 31, pos-counter 15, analytics 10)
- **Transports:** stdio (Claude Desktop, Cursor), HTTP (Docker, GoClaw)
- **Breaking Changes:** Allowed until 1.0 (minor bumps may break tool names/schemas)
- **npm:** Published with provenance signature

## Completed Phases (Pre-1.0)

### Phase 1: API Verification Probe
**Status:** ✅ DONE (2026-04-30)
- Sapo API endpoint availability assessment
- Bucket A smoke test (common endpoints)
- Bucket B POS endpoint verification (locations, suppliers, shifts, stock transfers)
- Undocumented endpoint marker strategy ([UNDOCUMENTED verified 2026-04-30])
- Decision gate G1 resolved: 15 pos-counter tools scoped

### Phase 2: Project Scaffold & Core Infrastructure
**Status:** ✅ DONE (2026-04-30)
- TypeScript + ESM setup (Node 20+)
- Zod schema validation framework
- Config module (env parsing, 23 vars)
- Logger module (stderr JSON, PII redaction)
- Client module (HTTP Basic Auth, retry, pagination)
- Guards module (destructive operation gating)
- Transports bootstrap (stdio, http stubs)
- Test framework (Vitest 4.1 + MSW)

### Phase 3: pos-online Mode (TDD)
**Status:** ✅ DONE (2026-04-30)
- **48 tools** across 5 categories:
  - Orders (list, get, create, draft, returns, transactions)
  - Customers (list, get, create, update, delete, addresses)
  - Products (read, variants read)
  - Pricing (price rules, discount codes)
  - Inventory (read)
- Destructive: cancel, delete, delete_strict (gated)
- Auto-pagination support
- 30+ test cases

### Phase 4: web Mode (TDD)
**Status:** ✅ DONE (2026-04-30)
- **31 tools:**
  - Collections (CRUD)
  - Blogs + Articles (CRUD)
  - Pages (CRUD)
  - Script tags (CRUD)
  - Store info (read)
  - Products SEO (read/write)
  - Variants (read)
- Destructive: delete (gated)
- 15+ test cases

### Phase 5: stdio Transport + 0.1.0 Milestone
**Status:** ✅ DONE (2026-04-30)
- StdioServerTransport integration
- CLI argument parsing (--mode, --transport, --port, --help, --version)
- SIGINT/SIGTERM graceful shutdown
- 0.1.0 shipped (intermediate milestone)

### Phase 6: pos-counter Mode (TDD)
**Status:** ✅ DONE (2026-04-30)
- **15 tools:**
  - Locations (list, get) [UNDOCUMENTED]
  - Payment methods (list) [UNDOCUMENTED]
  - Inventory write (adjust, connect, set)
  - Variants update
  - POS orders (list, get)
  - Suppliers (list, get) [UNDOCUMENTED]
  - POS shifts (list, get, close) [UNDOCUMENTED]
  - Stock transfers (list, get) [UNDOCUMENTED]
- Destructive: inventory_set (gated), shift_close
- Decision gate G2 resolved: write-probe hard-guard (test/dev/sandbox)
- Decision gate G4 resolved: category-based gating implemented
- 20+ test cases

### Phase 7: Streamable HTTP Transport
**Status:** ✅ DONE (2026-04-30)
- StreamableHTTPServerTransport integration
- Session model (UUID per client, isolated McpServer)
- Endpoints (GET /health, POST /mcp, GET /mcp SSE, DELETE /mcp)
- Bearer token auth (optional loopback, required non-loopback)
- CORS control (disabled by default)
- Session idle GC (30 min, passive)
- Concurrent session cap (100, 503 if full)
- 15+ test cases

### Phase 8: analytics Mode & Composed Tools
**Status:** ✅ DONE (2026-04-30)
- **10 tools** (composed from order/inventory/variant data):
  - revenue_summary (by day/week/month)
  - top_products, top_customers, customer_ltv
  - inventory_low_stock, inventory_value
  - tax_summary, online_vs_counter_breakdown, discount_usage_report
  - shift_report (with payment method breakdown)
- All read-only, auto-paginate
- 10+ test cases

### Phase 9: Documentation & 0.5.0 Release
**Status:** ✅ DONE (2026-04-30)
- README.md (262 lines, features, quickstart, modes, env, security, Docker, probing)
- CHANGELOG.md (per-version history)
- Tool descriptions (tool-description-style.md)
- Code standards (code-standards.md)
- System architecture (system-architecture.md)
- Project overview (project-overview-pdr.md)
- Codebase summary (codebase-summary.md)
- Deployment guide (deployment-guide.md)
- Project roadmap (project-roadmap.md)
- npm published with provenance
- Smoke tests passed (read, Inspector UI, Claude Desktop, Docker)
- MCP Registry PR submitted

## Decision Gates

| Gate | Status | Outcome |
|------|--------|---------|
| **G1: Pos-counter scope (Phase 6)** | ✅ Resolved | Bucket B probe verified 15 tools, 4 undocumented |
| **G2: Write-probe safety (Phase 6)** | ✅ Resolved | Hard-guard: test/dev/sandbox only, refuses production |
| **G3: Pre-1.0 breaking changes (PDR)** | ✅ Resolved | Allowed; documented in README |
| **G4: Destructive gating (Phase 6)** | ✅ Resolved | Category-based (cancel, delete, delete_strict, inventory_set, shift_close, cashbook_write); SAPO_ALLOW_OPS + per-tool override |

## Post-1.0 Roadmap (Deferred)

### 1. MCP Resources
**Priority:** High | **Effort:** Medium | **Timeline:** 0.6–0.7

Implement URI scheme for read-heavy data:
- `sapo://shop/info` → store metadata, settings
- `sapo://orders/today` → today's orders, summary stats
- `sapo://orders/pending` → open orders, to-do list
- `sapo://inventory/low-stock` → critical inventory alerts

**Rationale:** Resources more efficient than repeated tool calls for dashboard-style data.

**Acceptance criteria:**
- ✓ 4+ resource URIs implemented
- ✓ Resource content auto-refreshed on GET
- ✓ Integrated with claude.ai UI in Claude Desktop

### 2. MCP Prompts
**Priority:** High | **Effort:** Medium | **Timeline:** 0.7–0.8

Templated workflows for common merchant tasks:
- `respond_to_complaint` — investigate customer issue, propose refund/replacement
- `weekly_report` — revenue, top products, low stock, customer churn
- `seo_optimize_product` — analyze product, suggest title/description improvements
- `customer_followup` → identify churned customers, draft outreach email

**Rationale:** Prompts reduce setup time for LLM agents running merchant workflows.

**Acceptance criteria:**
- ✓ 4+ prompts with example arguments
- ✓ Prompts integrated with MCP client UI
- ✓ End-to-end workflow tested (prompt → tools → result)

### 3. Webhook Receiver
**Priority:** Medium | **Effort:** High | **Timeline:** 0.8–0.9

Sub-package: `sapo-mcp-webhooks`

Surfaced as MCP Events (once Events protocol stabilizes):
- Order create/update/cancel
- Customer create/update
- Inventory adjust
- Payment received

**Rationale:** Real-time integration for event-driven workflows (fraud detection, inventory sync).

**Acceptance criteria:**
- ✓ Webhook receiver Express app
- ✓ Signature verification (Sapo HMAC)
- ✓ Event bridging to MCP clients
- ✓ Retry + idempotency (dedup via Sapo request_id)
- ✓ Docker example with webhook tunnel (ngrok / Cloudflare)

### 4. OAuth 2.0 Partner App (Multi-tenant)
**Priority:** High | **Effort:** Very High | **Timeline:** 1.0 critical path

Transform single-tenant → multi-tenant SaaS:

**Unlocks:**
- 5 internal-only endpoints (purchase_orders, purchase_returns, stock_adjustments, cash_transactions, cashbook)
- 4 Phase 8b reports (cashflow_summary, pnl_summary, supplier_purchase_summary, daily_pos_report)
- Partner App integrations (Stripe, ShopBase, etc)

**Architecture changes:**
- OAuth 2.0 consent flow (Sapo auth server)
- Access token + refresh token management
- Shop list API (partner can manage multiple stores)
- Tenant isolation (separate SapoClient per shop)
- Scopes enforcement (read_products, write_orders, etc)

**Acceptance criteria:**
- ✓ OAuth consent flow integrated
- ✓ Access/refresh token lifecycle
- ✓ 5 new internal-only endpoints available
- ✓ 4 financial reports added
- ✓ Multi-tenant example (SaaS deployment guide)
- ✓ Rate limit per-tenant (not global)
- ✓ Multi-store admin dashboard

### 5. Storefront GraphQL Module
**Priority:** Low | **Effort:** Medium | **Timeline:** Post-1.0

Detect Private App vs Partner App, conditionally scope GraphQL tools:
- Query storefront data (products, collections) as customer
- Track custom attributes on orders
- Verify checkout flow integrations

**Rationale:** Complete e-commerce integration; some merchants may need customer-facing queries.

**Acceptance criteria:**
- ✓ Storefront GraphQL endpoint detected
- ✓ 5+ GraphQL tools (product query, collection query, checkout, custom attributes)
- ✓ Private App (limited scope) vs Partner App (full scope) detection
- ✓ Test against Sapo dev store + live merchant

## Known Deferrals & Limitations (0.5.0)

### Endpoints
- **4 undocumented pos-counter endpoints:** locations, suppliers, pos_shifts, stock_transfers (marked [UNDOCUMENTED verified 2026-04-30]; schema may change)
- **5 internal-only endpoints (403):** purchase_orders, purchase_returns, stock_adjustments, cash_transactions, cashbook (requires OAuth Partner App, deferred to post-1.0)

### Infrastructure
- **Nightly canary CI:** Not yet implemented; mandatory before 1.0
- **Session active timer:** Passive GC only; no active eviction thread
- **Rate limiting:** None; relies on Sapo API 429 + retry
- **Session persistence:** None; in-memory only (ephemeral)
- **Horizontal scaling:** No k8s guidance; single-instance focus

### Features
- **Resources:** sapo:// URI scheme deferred
- **Prompts:** Workflow templates deferred
- **Webhooks:** Event receiver sub-package deferred
- **OAuth:** Multi-tenant support deferred
- **GraphQL:** Storefront integration deferred
- **Docs site:** Mintlify deferred to 0.6+

## Release Schedule

| Phase | Target | Status |
|-------|--------|--------|
| **0.5.0** | 2026-04-30 | ✅ Released |
| **0.6.0** | 2026-06-30 (est) | Pending (Resources + Prompts) |
| **0.7.0** | 2026-08-31 (est) | Pending (Webhooks, GraphQL) |
| **1.0.0** | 2026-10-31 (est) | Pending (OAuth, full feature set) |

## Version Management

### 0.5.0 (Current)
- Pre-1.0 status
- Minor bumps may break tool names/schemas (warned in README)
- Manual version bumps via Changesets
- Conventional commits tracked

### 0.5.1 → 0.5.x
- Bug fixes
- Enhancement to existing tools (non-breaking)
- Changesets auto-versioning ready (not yet enabled)

### Post-0.5.1
- Auto-versioning from Changesets
- ci: false (pre-1.0 gates)
- Manual approval per release (until 1.0)

### 1.0.0 (Gate: Resources + Prompts + Webhooks + OAuth + GraphQL)
- Stable API
- Tool names/schemas locked
- Breaking changes gated (minor → major)
- Auto-versioning enabled
- SemVer strictly enforced

## Success Metrics

| Metric | Target (0.5.0) | Actual |
|--------|-----------------|--------|
| **Tools implemented** | 100+ | 104 ✅ |
| **Modes** | 4 | 4 ✅ |
| **Transports** | 2 | 2 ✅ |
| **Test coverage** | >80% | 84 tests (10 files) ✅ |
| **npm published** | Yes | ✅ |
| **Smoke tests passed** | Yes | ✅ (read, UI, Docker) |
| **Docs complete** | Yes | ✅ (README, architecture, standards) |
| **MCP Registry** | Submitted | ✅ (PR in flight) |

## Support & Contact

- **GitHub:** https://github.com/nguyennguyenit/Sapo-MCP
- **Issues:** https://github.com/nguyennguyenit/Sapo-MCP/issues
- **Discussions:** https://github.com/nguyennguyenit/Sapo-MCP/discussions
- **Author:** Plateau Nguyen (nguyennlt.ncc@gmail.com)
