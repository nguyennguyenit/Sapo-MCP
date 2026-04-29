# sapo-mcp

Model Context Protocol server for [Sapo.vn](https://www.sapo.vn) POS & e-commerce platform.

> **Status:** Early development (v0.x). API and tool names may change before 1.0.0.

## Features

- **4 modes:** `pos-online`, `pos-counter`, `web`, `analytics`
- **Safe by default:** Destructive ops gated via `SAPO_ALLOW_OPS` (default: none)
- **Runs locally:** stdio transport for Claude Desktop
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

*One of `SAPO_API_SECRET` or `SAPO_API_SECRET_FILE` is required.

## Modes

| Mode | Status | Description |
|------|--------|-------------|
| `pos-online` | Phase 3 | Online orders, customers, fulfillment |
| `web` | Phase 4 | Storefront, collections, articles, SEO |
| `pos-counter` | Phase 6 | POS counter, inventory, suppliers |
| `analytics` | Phase 8 | Revenue, top products, LTV, low stock |

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
