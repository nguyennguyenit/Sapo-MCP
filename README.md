# sapo-mcp

[![npm version](https://img.shields.io/npm/v/sapo-mcp.svg)](https://www.npmjs.com/package/sapo-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node 20+](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

Model Context Protocol server for [Sapo.vn](https://www.sapo.vn) POS & e-commerce platform.

> **Status:** Pre-1.0 (v0.5.0). Tool names and schemas may shift on minor
> bumps until 1.0. The 1.0 cut is gated on Resources, Prompts, a webhook
> receiver, and OAuth multi-tenant — see [Post-1.0 roadmap](#post-10-roadmap).

## Features

- **4 modes, 107 tools:** `pos-online` (51), `web` (31), `pos-counter` (15), `analytics` (10)
- **Two transports:** stdio (Claude Desktop, Cursor) and Streamable HTTP (Docker, GoClaw)
- **Safe by default:** destructive ops gated via `SAPO_ALLOW_OPS` (default: none); all destructive calls also require `confirm: true`
- **Single-tenant:** one shop per server instance via Private App credentials

## Installation

Requires **Node.js 20 or newer**. Verify with `node --version`.

### Option A — npx (no install)

Recommended for MCP clients (Claude Desktop, Cursor). Always pulls the latest published version:

```bash
npx -y sapo-mcp@latest --version
# → 0.5.1
```

### Option B — global install

```bash
npm install -g sapo-mcp
sapo-mcp --version
sapo-mcp --help
```

### Option C — local project dependency

```bash
npm install sapo-mcp
npx sapo-mcp --mode=pos-online
```

## Quick Start

### 1. Get Credentials

Create a Private App at [developers.sapo.vn](https://developers.sapo.vn):
- Store name: `mystorename` → `mystorename.mysapo.net`
- API Key + Secret

### 2. Configure your MCP client

#### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%/Claude/claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "sapo": {
      "command": "npx",
      "args": ["-y", "sapo-mcp", "--mode=pos-online,web,analytics"],
      "env": {
        "SAPO_STORE": "mystorename",
        "SAPO_API_KEY": "xxx",
        "SAPO_API_SECRET": "yyy"
      }
    }
  }
}
```

Restart Claude Desktop. Tools appear under the 🔌 plug icon.

#### Cursor

Edit `~/.cursor/mcp.json` or per-workspace `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "sapo": {
      "command": "npx",
      "args": ["-y", "sapo-mcp", "--mode=pos-online,web"],
      "env": {
        "SAPO_STORE": "mystorename",
        "SAPO_API_KEY": "xxx",
        "SAPO_API_SECRET": "yyy"
      }
    }
  }
}
```

#### MCP Inspector (test/debug)

```bash
npx @modelcontextprotocol/inspector \
  -e SAPO_STORE=mystorename \
  -e SAPO_API_KEY=xxx \
  -e SAPO_API_SECRET=yyy \
  npx -y sapo-mcp --mode=pos-online
```

Open the printed URL in a browser to inspect/invoke registered tools.

Use `--mode=pos-online,web,analytics` to register multiple modes (union of tools; shared tools registered once).

### 3. CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--mode=<modes>` | `pos-online` | Comma-separated list of modes to activate |
| `--transport=<t>` | `stdio` | Transport type (`stdio` or `http`) |
| `--port=<port>` | `3333` | HTTP port (ignored for stdio) |
| `--help` | — | Print usage and exit |
| `--version` | — | Print version and exit |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SAPO_STORE` | Yes | — | Store subdomain |
| `SAPO_API_KEY` | Yes | — | Private App API Key |
| `SAPO_API_SECRET` | Yes* | — | Private App API Secret |
| `SAPO_API_SECRET_FILE` | Yes* | — | Path to file containing secret (takes precedence) |
| `SAPO_ALLOW_OPS` | No | `""` | CSV of allowed destructive categories |
| `SAPO_MAX_AUTO_PAGES` | No | `10` | Max auto-pagination pages |
| `SAPO_RETRY_MAX` | No | `3` | HTTP retry attempts |
| `SAPO_LOG_LEVEL` | No | `info` | Log level (error/warn/info/debug/trace) |
| `SAPO_HTTP_HOST` | No† | `127.0.0.1` | HTTP bind host (loopback by default) |
| `SAPO_HTTP_PORT` | No | `3333` | HTTP port |
| `SAPO_HTTP_MAX_SESSIONS` | No | `100` | Max concurrent MCP sessions |
| `SAPO_HTTP_SESSION_IDLE_MS` | No | `1800000` | Idle session GC threshold (30 min) |
| `SAPO_MCP_AUTH_TOKEN` | No† | — | Bearer token. **Required** if host is non-loopback |
| `SAPO_HTTP_CORS_ORIGINS` | No | — | CSV of allowed CORS origins (default: disabled) |

*One of `SAPO_API_SECRET` or `SAPO_API_SECRET_FILE` is required.
†HTTP-only. Token is enforced when `SAPO_HTTP_HOST` is not `127.0.0.1`/`localhost`/`::1`.

## Modes

| Mode | Status | Description |
|------|--------|-------------|
| `pos-online` | 0.5.0 | Online orders, customers, fulfillment (46 tools) |
| `web` | 0.5.0 | Storefront, collections, articles, SEO (31 tools) |
| `pos-counter` | 0.5.0 | POS counter: locations, inventory write, suppliers, shifts, stock transfers (15 tools) |
| `analytics` | 0.5.0 | Composed reports: revenue, top products/customers, LTV, tax, channel breakdown, discount usage, shift report (10 tools) |

## Available Tools

### `pos-online` — 46 tools

Covers online order management, draft orders, fulfillments, refunds, customers, addresses, price rules, discount codes, products (read), variants (read), inventory (read), and transactions.

9 tools are destructive and gated via `SAPO_ALLOW_OPS` (categories: `cancel`, `delete`, `delete_strict`, `refund`).

### `web` — 31 tools

Covers collections, blogs, articles, pages, script tags, products SEO, store info, and variants (read).

6 tools are destructive and gated via `SAPO_ALLOW_OPS`.

### `analytics` — 10 tools

Composed read-only reports aggregated from order/inventory/variant data:

- `revenue_summary` — totals grouped by day/week/month
- `top_products`, `top_customers`, `customer_ltv`
- `inventory_low_stock`, `inventory_value`
- `tax_summary`, `online_vs_counter_breakdown`, `discount_usage_report`
- `shift_report` — POS shift summary with payment-method breakdown

All tools auto-paginate up to `SAPO_MAX_AUTO_PAGES`; results carry `truncated: true` when the cap is hit.

### `pos-counter` — 15 tools

Covers physical POS counter operations: locations, payment methods, inventory write (adjust/connect/set), variant update, POS orders (filtered), suppliers, POS shifts, and stock transfers.

1 tool is destructive and gated via `SAPO_ALLOW_OPS=inventory_set`: `set_inventory_level`.

> **Note: 5 internal-only endpoints excluded from pos-counter**
>
> `purchase_orders`, `purchase_returns`, `stock_adjustments`, `cash_transactions`, and `cashbook`
> return HTTP 403 for Private App credentials. These require an OAuth Partner App.
> Tracked for post-1.0.0 roadmap. See [`out-of-scope.md`](plans/260430-1000-sapo-mcp-implementation/out-of-scope.md).

### Tool Verification Status

Verification levels for the 107 tools (last updated 2026-04-30):

| Symbol | Level | What it means |
|---|---|---|
| ✅ | **Canary-monitored** | Endpoint + schema verified live; daily nightly probe via `.github/workflows/canary.yml` |
| 🟢 | **Live-verified** | Endpoint hit during development, schema captured to fixture, not in daily canary |
| 🟡 | **Docs-only** | Schema from `docs/sapo-api-reference.md` (Sapo official); mock tests only, no live probe |
| 🔵 | **Composed** | Not a Sapo endpoint — internal aggregation logic, logic-tested via unit tests |
| 🚨 | **Broken** | Known non-functional, see notes |

#### Canary-monitored endpoints (drift detected within 24h)

| Resource | Mode(s) | Endpoint |
|---|---|---|
| store | all | `/admin/store.json` |
| products (read) | pos-online, pos-counter | `/admin/products.json` |
| orders | pos-online, pos-counter | `/admin/orders.json` |
| customers | pos-online, pos-counter | `/admin/customers.json` |
| inventory_levels | pos-online, pos-counter | `/admin/inventory_levels.json` |
| locations | pos-counter | `/admin/locations.json` |
| draft_orders | pos-online | `/admin/draft_orders.json` |
| price_rules | pos-online | `/admin/price_rules.json` |
| pages | web | `/admin/pages.json` |
| suppliers | pos-counter | `/admin/suppliers.json` |
| stock_transfers | pos-counter | `/admin/stock_transfers.json` |
| payment_methods | pos-counter | `/admin/payment_methods.json` |

#### Live-verified (not in canary)

- **Refunds** (3 tools, pos-online): `list_refunds`, `get_refund`, `create_refund` — schema verified via live POST 2026-04-30 against order #1001
- **Order Transactions** (2): captured fixture from live transaction
- **Fulfillments** (4): probed during refunds investigation
- **POS orders** (2): use documented `/admin/orders?source_name=pos` filter
- **Customers/Customer-addresses write** (7): user-verified during 0.6.0 release

#### Docs-only (mock-tested)

Schema from Sapo official `docs/sapo-api-reference.md` sections 4.1–4.26. Tools work per documentation but not live-probed yet:

- Articles, Blogs, Collections, Discount codes (write), Inventory (write), Price rules (write), Product SEO, Script tags, Variants (write), and most destructive `delete_*` tools
- Risk: schema drift undetected until a user hits a 422

#### Composed (10 tools, analytics mode)

`revenue_summary`, `top_products`, `top_customers`, `customer_ltv`, `tax_summary`, `online_vs_counter_breakdown`, `discount_usage_report`, `shift_report`, `inventory_low_stock`, `inventory_value` — these aggregate data from multiple Sapo endpoints; correctness verified via unit tests, not endpoint contracts.

#### 🚨 Broken — needs investigation

| Tool | Resource | Issue |
|---|---|---|
| `list_pos_shifts` | pos_shifts | `/admin/pos_shifts.json` returns `Content-Type: text/html` (Sapo POS web app shell), not JSON. |
| `get_pos_shift` | pos_shifts | Same as above. JSON API endpoint not yet located. |

These 2 tools may fail at runtime. POS shift management currently requires admin UI.

For full read access (customers, products) combined with POS counter tools, use:
```
--mode=pos-online,pos-counter
```

### Multi-mode

`--mode=pos-online,web` activates the union of both sets. Tools shared across modes (e.g. variant reads) are registered once.

## Destructive Operations

Destructive tools (cancel, delete, bulk-delete) are blocked by default. To enable specific categories:

```bash
# Allow order cancellation and standard deletes only
SAPO_ALLOW_OPS=cancel,delete npx sapo-mcp --mode=pos-online
```

Supported categories: `cancel`, `delete`, `delete_strict`, `inventory_set`, `refund`, `shift_close`, `cashbook_write`.

All destructive tool calls also require `confirm: true` in the tool arguments — this prevents accidental execution when an LLM calls the tool without explicit intent.

## Security

ENV credentials are visible to other processes via `ps` / `/proc/<pid>/environ` on shared hosts. Use `SAPO_API_SECRET_FILE` to pass the secret via a file instead of an env var where possible.

Note: full secret-file isolation (reading the secret only at startup, then clearing) is tracked for the post-1.0 roadmap.

## Probing

Verify which Sapo API endpoints are available on your store before configuring tools.

```bash
# Read-only probe — safe to run against any store (GET only, no mutations)
SAPO_STORE=mystore SAPO_API_KEY=xxx SAPO_API_SECRET=yyy npm run probe
```

Outputs `plans/.../probe-results.json` (raw) and `plans/.../verify-report.md` (human-readable).
The report includes Bucket A smoke results and Bucket B POS endpoint availability —
used to decide Phase 6 (`pos-counter`) scope via decision gate G1.

Write-probe (`npm run probe:write`) is hard-guarded: it refuses to run unless
`SAPO_STORE` contains `test`, `dev`, or `sandbox`. Never runs against production.

See [`plans/260430-1000-sapo-mcp-implementation/verify-report.md`](plans/260430-1000-sapo-mcp-implementation/verify-report.md) for the latest results.

## HTTP Transport (Remote / Docker)

Run as an HTTP server for remote MCP clients (e.g. GoClaw) or self-hosted Docker:

```bash
# Local-only (no auth required)
sapo-mcp --mode=pos-online --transport=http --port=3333

# Public bind (auth token required)
SAPO_HTTP_HOST=0.0.0.0 \
SAPO_MCP_AUTH_TOKEN=$(openssl rand -hex 32) \
sapo-mcp --mode=pos-online --transport=http
```

Endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Liveness probe — returns `{ status, version, modes, sessions }` |
| `POST` | `/mcp`    | JSON-RPC over Streamable HTTP (creates a session on `initialize`) |
| `GET`  | `/mcp`    | SSE long-poll for an existing session (`mcp-session-id` header) |
| `DELETE` | `/mcp`  | Terminate a session |

**Session model:** Each MCP client gets a UUID session, isolated by an
`McpServer` instance. Idle sessions (`SAPO_HTTP_SESSION_IDLE_MS`) are
evicted automatically. Concurrent sessions cap at `SAPO_HTTP_MAX_SESSIONS`
(503 returned when full).

**Security:**
- Defaults to `127.0.0.1` — loopback only. Token optional.
- Setting `SAPO_HTTP_HOST=0.0.0.0` (or any non-loopback) **requires**
  `SAPO_MCP_AUTH_TOKEN`. The server refuses to start otherwise.
- CORS is **off by default**. Enable per-origin via `SAPO_HTTP_CORS_ORIGINS`
  (CSV of origins, or `*` for all). Only enable when serving browser-based
  agents.

### Docker

See [`examples/Dockerfile`](examples/Dockerfile) and
[`examples/docker-compose.yml`](examples/docker-compose.yml).

```bash
docker build -f examples/Dockerfile -t sapo-mcp:local .
docker run --rm -p 3333:3333 \
  -e SAPO_STORE=mystore \
  -e SAPO_API_KEY=xxx -e SAPO_API_SECRET=yyy \
  -e SAPO_HTTP_HOST=0.0.0.0 \
  -e SAPO_MCP_AUTH_TOKEN=$(openssl rand -hex 32) \
  sapo-mcp:local
```

## Development

```bash
npm install
npm run typecheck   # Type check
npm run lint        # Lint
npm run test        # Run tests
npm run build       # Build for release
```

## Post-1.0 roadmap

The 1.0.0 stable cut is gated on the following items, deferred from this release:

- **MCP Resources** — `sapo://shop/info`, `sapo://orders/today`, `sapo://orders/pending`, `sapo://inventory/low-stock`. Read-heavy data is more efficient as a Resource than repeated tool calls.
- **MCP Prompts** — templated workflows (`respond_to_complaint`, `weekly_report`, `seo_optimize_product`, `customer_followup`).
- **Webhook receiver** — sub-package surfacing Sapo webhooks as MCP events.
- **OAuth 2.0 Partner App** — multi-tenant SaaS deployments. Unlocks the 5 internal-only endpoints currently excluded from `pos-counter` and the 4 Phase 8b reports (`cashflow_summary`, `pnl_summary`, `supplier_purchase_summary`, `daily_pos_report`).
- **Storefront GraphQL module** — verify Private App access; scope tools if available.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the per-version history.

## License

MIT — See [LICENSE](LICENSE)
