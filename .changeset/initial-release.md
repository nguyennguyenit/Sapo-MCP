---
"sapo-mcp": minor
---

Initial public release.

- Mode `pos-online`: 48 tools (orders, draft orders, fulfillments, returns, customers, addresses, price rules, discount codes, products read, variants read, inventory read, transactions). 9 destructive gated via SAPO_ALLOW_OPS.
- Mode `web`: 31 tools (collections, blogs, articles, pages, script tags, products SEO, store info, variants read). 6 destructive gated.
- Multi-mode supported: `--mode=pos-online,web`.
- Transport: stdio (HTTP coming in 0.2.0).
- CLI: `--help`, `--version`, `--mode=`, `--transport=`.
- Node 20+, ESM only, MIT license.
