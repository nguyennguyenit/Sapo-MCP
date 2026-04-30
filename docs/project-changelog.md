# Project Changelog

Detailed technical decisions and discoveries during development.
Companion to `CHANGELOG.md` (release notes) — this file logs the *why* and *how it was learned*.

---

## 2026-04-30 — order_returns → refunds migration

**Context:** Audit of 107 tools against `docs/sapo-api-reference.md` flagged 5 `order_returns` tools as undocumented. Live probe on store `giapducthangscs` to verify them.

**Discovery sequence (Phase γ probe):**

1. `GET /admin/order_returns.json` returns `200 []` — endpoint exists, namespace valid.
2. `POST /admin/order_returns.json` requires `fulfillment_line_item_id`. Sourced candidates from `/admin/orders/{id}/fulfillments.json` (line_items[].id), `/admin/fulfillment_orders.json` (line_items[].id) — every value rejected with `"fulfillment_line_item_id X is not exist"`.
3. Inspection of admin UI's network panel revealed the "Hoàn trả" action POSTs to **`/admin/orders/{id}/refunds.json`** (Shopify-style, documented section 4.20) — NOT to `/order_returns`.
4. Created live refund via admin UI: resulting record has `return_id: null` → confirms admin never touches `order_returns` table.
5. Probed `POST /admin/orders/{id}/refunds.json` — verified schema, captured fixture, confirmed Private App auth works.

**Conclusion:** `/admin/order_returns` is a parallel/internal Sapo resource. List endpoint accessible but mutate ops impossible without internal IDs. Tool `create_order_return` was always broken — never tested live.

**Action:** Replaced 5 deprecated tools with 3 refund tools (`list_refunds`, `get_refund`, `create_refund`). Added `refund` category to `SAPO_ALLOW_OPS`. Net tool count: 109 → 107.

**Schema findings (refunds):**
- Required: at least one of `refund_line_items` / `order_adjustments` / `transactions`
- DELETE not supported (405); refunds immutable once created
- Refund amount must be ≤ net payment received (Sapo enforces 422)
- POST with empty transactions → "ghost" refund (line items recorded, no money moved, Sapo auto-adds order_adjustment kind=refund_discrepancy)

**Bonus quirks discovered (saved to memory):**
- `GET /admin/orders.json?status=any` returns `[]` even when orders exist — must omit filter
- `/admin/orders/{id}/fulfillment_orders.json` exists as separate undocumented resource (Shopify-style)

**Files:** see commit `27b4318` (`refactor(refunds): replace order_returns tools with refunds API`).

**Open questions:** None — migration complete, all 908 tests pass.
