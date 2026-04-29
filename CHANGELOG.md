# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Project scaffold: TypeScript ESM, tsup build, Vitest tests, Biome lint
- Sapo HTTP client: Basic Auth, exponential backoff retry, since_id pagination
- Category-based destructive guard (`SAPO_ALLOW_OPS`)
- ENV validation via zod
- Stderr-only logger with PII redaction policy
- Mode framework placeholders: web, pos-online, pos-counter, analytics
- CI: GitHub Actions test matrix (Node 20+22), release workflow, nightly canary
