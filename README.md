# sapo-mcp

[![npm version](https://img.shields.io/npm/v/sapo-mcp.svg)](https://www.npmjs.com/package/sapo-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node 20+](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

Model Context Protocol server for [Sapo.vn](https://www.sapo.vn) POS & e-commerce platform.

> **Status:** Early development (v0.x). API and tool names may change before 1.0.0.
> 0.1.0 ships `pos-online` (48 tools) and `web` (31 tools) modes.
> 0.2.0 adds `pos-counter` (15 tools) — physical POS counter operations.

## Features

- **3 modes in 0.2.0:** `pos-online`, `web`, `pos-counter` (`analytics` in a later release)
- **Safe by default:** Destructive ops gated via `SAPO_ALLOW_OPS` (default: none)
- **Runs locally:** stdio transport for Claude Desktop (HTTP transport in 0.2.0)
- **Single-tenant:** One shop per server instance via Private App credentials

## Quick Start

### 1. Get Credentials

Create a Private App at [developers.sapo.vn](https://developers.sapo.vn):
- Store name: `mystorename` → `mystorename.mysapo.net`
- API Key + Secret

### 2. Claude Desktop Config

```json
{
  "mcpServers": {
    "sapo-pos": {
      "command": "npx",
      "args": ["sapo-mcp", "--mode=pos-online"],
      "env": {
        "SAPO_STORE": "mystorename",
        "SAPO_API_KEY": "xxx",
        "SAPO_API_SECRET": "yyy"
      }
    }
  }
}
```

Use `--mode=pos-online,web` to register both modes at once (union of tools, shared variants registered once).

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
| `pos-online` | 0.1.0 | Online orders, customers, fulfillment |
| `web` | 0.1.0 | Storefront, collections, articles, SEO |
| `pos-counter` | 0.2.0 | POS counter: locations, inventory write, suppliers, shifts, stock transfers |
| `analytics` | Future | Revenue, top products, LTV, low stock |

## Available Tools

### `pos-online` — 48 tools

Covers online order management, draft orders, fulfillments, returns, customers, addresses, price rules, discount codes, products (read), variants (read), inventory (read), and transactions.

9 tools are destructive and gated via `SAPO_ALLOW_OPS`.

### `web` — 31 tools

Covers collections, blogs, articles, pages, script tags, products SEO, store info, and variants (read).

6 tools are destructive and gated via `SAPO_ALLOW_OPS`.

### `pos-counter` — 15 tools (0.2.0)

Covers physical POS counter operations: locations, payment methods, inventory write (adjust/connect/set), variant update, POS orders (filtered), suppliers, POS shifts, and stock transfers.

1 tool is destructive and gated via `SAPO_ALLOW_OPS=inventory_set`: `set_inventory_level`.

> **Warning: 4 undocumented endpoints in pos-counter**
>
> The following endpoints are not listed in Sapo official docs. They were verified working
> on 2026-04-30 via API probe but **schema may change without notice**:
> - `locations` (`list_locations`, `get_location`)
> - `payment_methods` (`list_payment_methods`)
> - `suppliers` (`list_suppliers`, `get_supplier`)
> - `pos_shifts` (`list_pos_shifts`, `get_pos_shift`)
> - `stock_transfers` (`list_stock_transfers`, `get_stock_transfer`)
>
> All undocumented tool descriptions begin with `[UNDOCUMENTED endpoint, verified 2026-04-30, schema may change]`.

> **Note: 5 internal-only endpoints excluded from pos-counter**
>
> `purchase_orders`, `purchase_returns`, `stock_adjustments`, `cash_transactions`, and `cashbook`
> return HTTP 403 for Private App credentials. These require an OAuth Partner App.
> Tracked for post-1.0.0 roadmap. See [`out-of-scope.md`](plans/260430-1000-sapo-mcp-implementation/out-of-scope.md).

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

Supported categories: `cancel`, `delete`, `delete_strict`, `inventory_set`.

All destructive tool calls also require `confirm: true` in the tool arguments — this prevents accidental execution when an LLM calls the tool without explicit intent.

## Security

ENV credentials are visible to other processes via `ps` / `/proc/<pid>/environ` on shared hosts. Use `SAPO_API_SECRET_FILE` to pass the secret via a file instead of an env var where possible.

Note: full secret-file isolation (reading the secret only at startup, then clearing) is tracked for 0.2.0.

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

## License

MIT — See [LICENSE](LICENSE)
