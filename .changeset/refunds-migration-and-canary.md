---
"sapo-mcp": minor
---

**Refunds migration + Canary CI**

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
