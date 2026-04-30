# Project Overview & PDR

## Overview

**sapo-mcp** is a Model Context Protocol (MCP) server providing AI agents and Claude integrations with safe, authenticated access to Sapo.vn's POS and e-commerce platform via the Private App API.

- **Current version:** 0.7.0 (pre-1.0)
- **Release date:** 2026-04-30
- **License:** MIT
- **Repository:** https://github.com/nguyennguyenit/Sapo-MCP

## Vision & Problem Statement

### Problem
Sapo.vn merchants lack programmatic access to their POS and e-commerce data for AI-driven workflows: order analytics, inventory optimization, customer insights, and operational automation. Existing integrations are slow or proprietary.

### Vision
Enable merchants to leverage AI agents (Claude, custom LLMs) to autonomously manage orders, inventory, pricing, and reporting with safety guardrails and single-tenant isolation.

## Users & Personas

| Persona | Need | Scope |
|---------|------|-------|
| **Merchant/Store Manager** | Read sales, inventory, customers; run reports | pos-online, web, pos-counter, analytics |
| **POS Staff** | Inventory write, shift management, supplier tracking | pos-counter, inventory-write |
| **Integration Partner** | Multi-tenant via OAuth for SaaS platform | Deferred to 1.0+ (OAuth) |
| **Developer** | CLI, HTTP server, reproducible setup | stdio transport, Docker |

## Scope (0.7.0)

### In Scope
- **4 modes:** pos-online (51), web (31), pos-counter (15), analytics (10) — 105 unique tools (2 shared: list_variants_for_product, get_variant)
- **2 transports:** stdio (Claude Desktop, Cursor), Streamable HTTP (Docker, GoClaw)
- **Single-tenant:** Private App credentials only
- **Destructive safety:** Category-based gating (SAPO_ALLOW_OPS), confirm flag, 7 categories
- **24 Zod schemas** for tool I/O validation

### Out of Scope (Deferred 1.0+)
- **MCP Resources:** sapo:// URI scheme for read-heavy data
- **MCP Prompts:** templated workflows
- **Webhook receiver:** event streaming
- **OAuth 2.0 Partner App:** multi-tenant SaaS
- **Storefront GraphQL:** Private App vs Partner App detection
- **Session-level rate limiting:** adaptive queue

### Known Issues / Deferrals
- 3 pos-counter endpoints undocumented (marked [UNDOCUMENTED verified 2026-04-30]): locations, suppliers, stock_transfers
- 1 pos-counter endpoint non-functional: pos_shifts returns text/html instead of JSON (Sapo POS web shell)
- 5 internal-only endpoints require OAuth (purchase_orders, purchase_returns, stock_adjustments, cash_transactions, cashbook)
- Session eviction is passive (no active timer; relies on idle GC)
- 429 rate limit retry only (no adaptive queue)

## Requirements

### Functional
1. List/get/create/update/delete resources across 4 modes
2. Compose analytics from order/inventory/variant data
3. Support multi-mode activation (union of tools, deduped)
4. Enforce destructive operation gating per category
5. PII redaction in logs (phone, email, name, address, card_number)
6. Basic Auth + optional Bearer token (HTTP transport)
7. Auto-paginate with truncation cap (SAPO_MAX_AUTO_PAGES)
8. Retry with exp backoff + Retry-After respect

### Non-Functional
- **Performance:** <1s latency per tool call (Sapo API dependent)
- **Reliability:** 3-attempt retry, non-retryable on 401/404/422
- **Availability:** 30s HTTP timeout, 100 concurrent sessions, 30-min idle GC
- **Security:** PII redaction, bearer auth, CORS off by default, non-loopback requires token
- **Compatibility:** Node 20+, ESM, provenance-signed npm publish

## Success Criteria

| Criterion | Status (0.7.0) |
|-----------|-----------------|
| 4 modes fully implemented | ✅ DONE (Phase 1–9) |
| 105 unique tools registered & tested | ✅ DONE |
| stdio + HTTP transports working | ✅ DONE |
| >80% test coverage | ✅ DONE (84 tests, 10 files) |
| Nightly canary CI for schema drift | ✅ DONE (daily 2AM UTC) |
| npm published + smoke tested | ✅ DONE |
| Destructive ops gated (7 categories) | ✅ DONE (SAPO_ALLOW_OPS) |
| PII redaction active | ✅ DONE |
| Docker example provided | ✅ DONE |
| README + tool descriptions clear | ✅ DONE |

## Constraints

### Technical
- Single-tenant only (Private App, no multi-tenant OAuth in 0.7.0)
- 30s timeout on all HTTP calls (Sapo API latency)
- Max 100 concurrent sessions (memory + file descriptor bound)
- Retry only on transient (5xx, 429); not on auth/validation (401/404/422)

### Business
- Pre-1.0 minor bumps may break tool names/schemas (warn in README)
- Changesets v2 for tracking; manual version bumps until post-0.5.1
- Internal-only endpoints blocked (403) until OAuth Partner App
- No docs site (Mintlify deferred to 0.6+)

### Operational
- No k8s/scaling guidance (single-instance focus)
- Session eviction passive (GC only, no active timer)
- No adaptive rate limiting or queue
- Nightly canary CI mandatory before 1.0 (not yet implemented)

## Version & Release Model

### Current Version: 0.7.0
- **Release date:** 2026-04-30
- **Status:** Stable, ready for production single-tenant use
- **Breaking changes allowed:** Yes (pre-1.0)
- **npm:** published with provenance signature

### Release Process (0.7.0)
1. Changesets v2 for tracking
2. Manual version bump + changelog
3. npm publish with token (NPM_TOKEN granular)
4. Smoke test (probe read, Inspector UI, Claude Desktop, Docker)
5. MCP Registry PR (1–4 weeks)
6. GitHub tag (v0.7.0)

### Post-0.5.1 Model
- Auto-versioning via Changesets
- Conventional commits (feat/fix/docs/chore)
- Automated npm publish (ci: false for pre-1.0)

## Pre-1.0 Status

| Phase | Feature | Status | Complete Date |
|-------|---------|--------|---------------|
| 1 | API verification probe | ✅ | 2026-04-30 |
| 2 | Project scaffold + core infra | ✅ | 2026-04-30 |
| 3 | pos-online mode TDD (51 tools) | ✅ | 2026-04-30 |
| 4 | web mode TDD (31 tools) | ✅ | 2026-04-30 |
| 5 | stdio transport + 0.1.0 | ✅ | 2026-04-30 |
| 6 | pos-counter TDD (15 tools) | ✅ | 2026-04-30 |
| 7 | Streamable HTTP transport | ✅ | 2026-04-30 |
| 8 | analytics mode (10 tools) | ✅ | 2026-04-30 |
| 9 | Docs + 0.7.0 release | ✅ | 2026-04-30 |

## Post-1.0 Roadmap

Deferred features required for 1.0.0 stable cut:

1. **MCP Resources** — sapo://shop/info, sapo://orders/today, sapo://orders/pending, sapo://inventory/low-stock
2. **MCP Prompts** — respond_to_complaint, weekly_report, seo_optimize_product, customer_followup
3. **Webhook receiver** — sub-package surfacing Sapo webhooks as MCP events
4. **OAuth 2.0 Partner App** — multi-tenant SaaS, unlocks 5 internal-only endpoints + 4 Phase 8b reports
5. **Storefront GraphQL** — detect/scope tools for Private App vs Partner App

Decision gates resolved:
- **G1** — Bucket B scope (15 pos-counter tools decided via probe)
- **G2** — Write-probe hard-guard (test/dev/sandbox only)
- **G3** — Pre-1.0 minor=breaking allowed (documented in README)
- **G4** — Destructive category gates implemented (SAPO_ALLOW_OPS)

## Contact & Support

- **Author:** Plateau Nguyen (nguyennlt.ncc@gmail.com)
- **Issues:** GitHub: https://github.com/nguyennguyenit/Sapo-MCP/issues
- **Discussions:** GitHub: https://github.com/nguyennguyenit/Sapo-MCP/discussions
