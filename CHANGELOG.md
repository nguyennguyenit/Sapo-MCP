# Changelog

## 0.7.0

### Minor Changes

- 30589d2: **Refunds migration + Canary CI**

  ### Breaking changes (pre-1.0)

  - **Removed 5 deprecated `order_returns` tools** that never worked on standard stores — `list_order_returns`, `get_order_return`, `create_order_return`, `refund_order_return`, `cancel_order_return`. Sapo's `/admin/order_returns` endpoint requires `fulfillment_line_item_id` which is not exposed via any public Private App endpoint, making `create_order_return` permanently unusable.

  ### Added

  - **3 new refund tools** (pos-online mode) using Sapo's documented `/admin/orders/{id}/refunds.json` endpoint (the same one Sapo admin UI uses):
    - `list_refunds` — list refunds for an order
    - `get_refund` — get a single refund
    - `create_refund` — create a refund (destructive, gated via `SAPO_ALLOW_OPS=refund`)
  - **New `refund` destructive category** in `SAPO_ALLOW_OPS` — set alongside `cancel`, `delete`, `delete_strict`, `inventory_set`, etc.
  - **Nightly canary CI** (`.github/workflows/canary.yml`) — schema drift detection against live Sapo store. Probes 12 endpoints and parses each with the same Zod schema tools use; files a GitHub Issue when drift is detected. Run locally with `npm run canary`.
  - **Tool Verification Status section** in README — per-tool status table (canary-monitored / live-verified / docs-only / composed / broken).

  ### Fixed

  - `PageSchema.modified_on` is now nullable — Sapo returns `null` when a page has never been modified after creation. Caught by the new canary CI on its first run.
  - Tool count corrections in README, JSDoc, and docs: 105 unique tools (107 mode-summed with overlap).

  ### Documented

  - `list_pos_shifts` and `get_pos_shift` are flagged as **broken** — `/admin/pos_shifts.json` returns `Content-Type: text/html` (Sapo POS web app shell), not JSON. The JSON API endpoint has not been located. These 2 tools may fail at runtime; POS shift management currently requires the Sapo admin UI.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Pre-1.0 notice.** Until 1.0.0, minor version bumps (`0.x.0`) may include
> breaking changes to tool names, schemas, or env vars. Patch bumps (`0.x.y`)
> are bug-fix and additive only. The 1.0.0 stability cut is gated on MCP
> Resources + Prompts + webhook receiver + OAuth 2.0 multi-tenant support
> (see [Post-1.0 roadmap](README.md#post-10-roadmap)).

## [0.6.0] — 2026-04-30

### Added

- **Customer write tools (pos-online):** `create_customer`, `update_customer` — POST/PUT `/admin/customers.json`. Email or phone required for create; partial update for existing customers.
- **Customer address write tools (pos-online):** `add_customer_address`, `update_customer_address`, `set_default_customer_address` — wraps Sapo's dedicated default endpoint (`PUT /customers/{id}/addresses/{addr_id}/default.json`).
- Schemas: `AddressSingleResponseSchema` for POST/PUT address responses.

### Fixed

- `search_customers` now calls `/admin/customers.json?query=…` instead of `/admin/customers/search.json`. The latter is internal-only and returns 403 for Private Apps even with full `read_customers` scope. Same query semantics, no breaking change to tool inputs/outputs.

### Notes

- Customer write tools are **not gated** under `SAPO_ALLOW_OPS` — consistent with `create_article`, `update_collection`, etc. Sapo Private App scope (`write_customers`) remains the auth gate. `delete_customer` continues to be gated under `delete_strict`.
- Tool count per mode updated: pos-online now exposes 53 tools with `SAPO_ALLOW_OPS=*` (44 read+write + 9 destructive), up from 48.

## [0.5.1] — 2026-04-30

### Fixed

- CLI: `--version` and `--help` now work when invoked via the `node_modules/.bin/sapo-mcp` shim (or `npx sapo-mcp`). The entry-point guard in `src/index.ts` resolved `process.argv[1]` literally, missing the case where npm symlinks the bin to `dist/index.mjs`. Now resolves symlinks via `realpathSync` before comparing.

## [0.5.0] — 2026-04-30

First public release. Four modes, two transports, 104 tools.

### Added — Modes

- **`pos-online` (48 tools)** — online order management, draft orders,
  fulfillments, returns, customers, addresses, price rules, discount codes,
  products (read), variants (read), inventory (read), order transactions.
  9 destructive tools gated via `SAPO_ALLOW_OPS`.
- **`web` (31 tools)** — collections, blogs, articles, pages, script tags,
  product SEO, store info, variants (read).
  6 destructive tools gated via `SAPO_ALLOW_OPS`.
- **`pos-counter` (15 tools)** — locations, payment methods, inventory write
  (adjust/connect/set), variant update, POS orders (filtered), suppliers,
  POS shifts, stock transfers. Includes 4 undocumented endpoints verified
  2026-04-30.
- **`analytics` (10 tools)** — composed read-only reports: `revenue_summary`,
  `top_products`, `top_customers`, `customer_ltv`, `inventory_low_stock`,
  `inventory_value`, `tax_summary`, `online_vs_counter_breakdown`,
  `discount_usage_report`, `shift_report`.

Multi-mode support via comma-separated `--mode=pos-online,web,analytics`;
shared tools (e.g. variant reads) registered once.

### Added — Transports

- **stdio** — default; for Claude Desktop, Cursor, and other local MCP clients.
- **Streamable HTTP** (`--transport=http --port=3333`) — for remote / Docker
  deployments. Per-session `StreamableHTTPServerTransport`, idle session GC
  (`SAPO_HTTP_SESSION_IDLE_MS`, default 30 min), max-session limit
  (`SAPO_HTTP_MAX_SESSIONS`, default 100), graceful SIGTERM cleanup.

### Added — Security

- Bearer token auth (`SAPO_MCP_AUTH_TOKEN`) for HTTP transport — timing-safe
  comparison; **required** when `SAPO_HTTP_HOST` is non-loopback (server
  refuses to start otherwise).
- CORS off by default; opt-in via `SAPO_HTTP_CORS_ORIGINS` CSV.
- Category-based destructive guard (`SAPO_ALLOW_OPS`) — categories: `cancel`,
  `delete`, `delete_strict`, `inventory_set`. All destructive tool calls
  additionally require `confirm: true`.
- ENV credentials policy: `SAPO_API_SECRET_FILE` preferred over
  `SAPO_API_SECRET` (mitigates `/proc/<pid>/environ` exposure on shared hosts).
- Stderr-only structured logging with PII redaction (info/debug/trace levels).

### Added — Tooling

- Sapo HTTP client: Basic Auth, exponential backoff with `Retry-After` respect,
  no retry on 401/404/422, since_id auto-pagination capped at
  `SAPO_MAX_AUTO_PAGES`.
- Read probe (`npm run probe`) — Bucket A/B endpoint smoke check; outputs
  `verify-report.md`.
- Write probe (`npm run probe:write`) — hard-guarded; refuses to run unless
  `SAPO_STORE` contains `test`/`dev`/`sandbox`.
- Capture-fixtures script (`npm run capture:fixtures`) — pin live-API responses
  for schema tests.
- CI: GitHub Actions test matrix (Node 20 + 22), nightly canary against
  dedicated dev store, Changesets-based release with npm provenance.
- Docker: `examples/Dockerfile` (multi-stage, non-root, healthcheck) and
  `examples/docker-compose.yml`.

### Notes

- 5 endpoints (`purchase_orders`, `purchase_returns`, `stock_adjustments`,
  `cash_transactions`, `cashbook`) return HTTP 403 for Private App
  credentials. They are intentionally excluded; OAuth Partner App support
  is tracked for the post-1.0 roadmap.
- `pos-counter` ships 4 undocumented endpoints verified working 2026-04-30
  (`locations`, `payment_methods`, `suppliers`, `pos_shifts`,
  `stock_transfers`). Tool descriptions begin with `[UNDOCUMENTED endpoint,
verified 2026-04-30, schema may change]`. Nightly canary monitors drift.
