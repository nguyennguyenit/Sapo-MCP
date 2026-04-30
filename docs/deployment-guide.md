# Deployment Guide

## Overview

sapo-mcp supports two deployment models: **CLI** (development, Claude Desktop) and **Server** (production, Docker, GoClaw). This guide covers setup, security hardening, and operation.

For detailed release procedures, see RELEASE.md (authoritative).

## npm Installation

### Install from npm

```bash
npm install sapo-mcp
# or globally
npm install -g sapo-mcp
```

### Run via npx (No Install)

```bash
npx sapo-mcp --mode=pos-online
```

### Binary Location

After installation:
```bash
# Global
which sapo-mcp
/usr/local/bin/sapo-mcp

# Local (npm package)
./node_modules/.bin/sapo-mcp
```

## Deployment Models

### 1. CLI (Local Development)

**Use case:** Claude Desktop, Cursor, local development

#### Claude Desktop Config

```json
{
  "mcpServers": {
    "sapo-pos": {
      "command": "npx",
      "args": ["sapo-mcp", "--mode=pos-online"],
      "env": {
        "SAPO_STORE": "mystorename",
        "SAPO_API_KEY": "xxx",
        "SAPO_API_SECRET": "yyy",
        "SAPO_LOG_LEVEL": "info"
      }
    }
  }
}
```

#### Multi-mode Config

```json
{
  "mcpServers": {
    "sapo-mcp-all": {
      "command": "npx",
      "args": ["sapo-mcp", "--mode=pos-online,web,pos-counter,analytics"],
      "env": {
        "SAPO_STORE": "mystorename",
        "SAPO_API_KEY": "xxx",
        "SAPO_API_SECRET": "yyy",
        "SAPO_LOG_LEVEL": "debug"
      }
    }
  }
}
```

#### Environment Variables (Secure Practices)

**Bad (visible to ps):**
```bash
export SAPO_API_SECRET=mysecret
npx sapo-mcp --mode=pos-online
```

**Better (file-only):**
```bash
echo "mysecret" > /run/secrets/sapo_secret
chmod 600 /run/secrets/sapo_secret
SAPO_API_SECRET_FILE=/run/secrets/sapo_secret npx sapo-mcp --mode=pos-online
```

**Best (Claude Desktop):**
Use `SAPO_API_SECRET_FILE` in config's `env`:
```json
{
  "env": {
    "SAPO_API_SECRET_FILE": "/run/secrets/sapo_secret"
  }
}
```

### 2. HTTP Server (Remote / Docker)

**Use case:** Docker, GoClaw, remote clients

#### Local-only (No Auth)

```bash
sapo-mcp --mode=pos-online --transport=http --port=3333

# Listens on 127.0.0.1:3333 (loopback only)
# No auth required
# CORS disabled
```

**Client access:**
```bash
curl http://127.0.0.1:3333/health
```

#### Public (Auth Required)

```bash
SAPO_HTTP_HOST=0.0.0.0 \
SAPO_MCP_AUTH_TOKEN=$(openssl rand -hex 32) \
sapo-mcp --mode=pos-online --transport=http --port=3333

# Listens on 0.0.0.0:3333 (all interfaces)
# Bearer token required
# Store token securely (e.g., GitHub secret, K8s secret)
```

**Client access:**
```bash
TOKEN="<SAPO_MCP_AUTH_TOKEN>"
curl -H "Authorization: Bearer $TOKEN" http://<host>:3333/health
```

#### Health Check

```bash
curl http://localhost:3333/health

# Response:
{
  "status": "ok",
  "version": "0.5.0",
  "modes": ["pos-online"],
  "sessions": 0
}
```

## Docker Deployment

### Build Image

**Multi-stage Dockerfile** (examples/Dockerfile):
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --prefer-offline

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY dist/ ./dist
COPY package.json ./
RUN addgroup -g 1000 sapo && adduser -D -u 1000 -G sapo sapo
USER sapo
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3333/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"
CMD ["node", "dist/index.mjs", "--mode=pos-online", "--transport=http"]
```

### Build & Run

```bash
# Build
docker build -f examples/Dockerfile -t sapo-mcp:latest .
docker tag sapo-mcp:latest sapo-mcp:0.5.0

# Run (local, no auth)
docker run --rm -p 3333:3333 \
  -e SAPO_STORE=mystore \
  -e SAPO_API_KEY=xxx \
  -e SAPO_API_SECRET=yyy \
  sapo-mcp:latest

# Run (public, auth required)
docker run --rm -p 3333:3333 \
  -e SAPO_STORE=mystore \
  -e SAPO_API_KEY=xxx \
  -e SAPO_API_SECRET=yyy \
  -e SAPO_HTTP_HOST=0.0.0.0 \
  -e SAPO_MCP_AUTH_TOKEN=$(openssl rand -hex 32) \
  sapo-mcp:latest

# Run with secret file (bind-mount)
docker run --rm -p 3333:3333 \
  -e SAPO_STORE=mystore \
  -e SAPO_API_KEY=xxx \
  -e SAPO_API_SECRET_FILE=/run/secrets/sapo_secret \
  -v /path/to/secret:/run/secrets/sapo_secret:ro \
  -e SAPO_HTTP_HOST=0.0.0.0 \
  -e SAPO_MCP_AUTH_TOKEN=$(openssl rand -hex 32) \
  sapo-mcp:latest
```

### Docker Compose

**examples/docker-compose.yml:**
```yaml
version: '3.9'

services:
  sapo-mcp:
    build:
      context: .
      dockerfile: examples/Dockerfile
    ports:
      - "3333:3333"
    environment:
      SAPO_STORE: ${SAPO_STORE}
      SAPO_API_KEY: ${SAPO_API_KEY}
      SAPO_API_SECRET_FILE: /run/secrets/sapo_secret
      SAPO_HTTP_HOST: 0.0.0.0
      SAPO_MCP_AUTH_TOKEN: ${SAPO_MCP_AUTH_TOKEN}
      SAPO_LOG_LEVEL: info
    secrets:
      - sapo_secret
    healthcheck:
      test: ["CMD", "curl", "-f", "-H", "Authorization: Bearer ${SAPO_MCP_AUTH_TOKEN}", "http://localhost:3333/health"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 40s

secrets:
  sapo_secret:
    file: ./secrets/sapo_secret
```

**Usage:**
```bash
# Create .env
cat > .env <<EOF
SAPO_STORE=mystore
SAPO_API_KEY=xxx
SAPO_API_SECRET_FILE=/run/secrets/sapo_secret
SAPO_MCP_AUTH_TOKEN=$(openssl rand -hex 32)
EOF

# Create secret
mkdir -p secrets
echo "yyy" > secrets/sapo_secret
chmod 600 secrets/sapo_secret

# Run
docker-compose up -d

# Verify
docker-compose logs sapo-mcp
curl -H "Authorization: Bearer $SAPO_MCP_AUTH_TOKEN" http://localhost:3333/health
```

## Environment Variable Reference

### Required (Sapo Auth)

| Variable | Example | Note |
|----------|---------|------|
| `SAPO_STORE` | `mystore` | Store subdomain; `mystore.mysapo.net` |
| `SAPO_API_KEY` | `xxx` | Private App API Key |
| `SAPO_API_SECRET` | `yyy` | Private App API Secret (or use SAPO_API_SECRET_FILE) |

### Conditional (Single Env)

| Variable | When Required | Example |
|----------|---------------|---------|
| `SAPO_API_SECRET_FILE` | Instead of SAPO_API_SECRET | `/run/secrets/sapo_secret` |
| `SAPO_MCP_AUTH_TOKEN` | If SAPO_HTTP_HOST non-loopback | Random 32-byte hex via `openssl rand -hex 32` |

### Optional (Permissions & Features)

| Variable | Default | Values |
|----------|---------|--------|
| `SAPO_ALLOW_OPS` | `` (none) | CSV: `cancel`, `delete`, `delete_strict`, `inventory_set`, `shift_close`, `cashbook_write`, or `*` |
| `SAPO_MAX_AUTO_PAGES` | `10` | Integer (0–unlimited, but memory impact) |
| `SAPO_RETRY_MAX` | `3` | Integer (1–10) |
| `SAPO_LOG_LEVEL` | `info` | `error`, `warn`, `info`, `debug`, `trace` |
| `SAPO_LOG_PII` | `false` | `true` or `false` (opt-in full PII logging) |

### Optional (HTTP Transport)

| Variable | Default | Purpose |
|----------|---------|---------|
| `SAPO_HTTP_HOST` | `127.0.0.1` | Bind address (loopback vs public) |
| `SAPO_HTTP_PORT` | `3333` | Listen port |
| `SAPO_HTTP_MAX_SESSIONS` | `100` | Concurrent session cap |
| `SAPO_HTTP_SESSION_IDLE_MS` | `1800000` | 30 min idle GC threshold |
| `SAPO_HTTP_CORS_ORIGINS` | `` (off) | CSV of origins or `*` (use with caution) |

## Smoke Test Checklist

After deployment, verify:

### Read Operations
```bash
# CLI
SAPO_STORE=test SAPO_API_KEY=xxx SAPO_API_SECRET=yyy \
  npx sapo-mcp --mode=pos-online

# Test tool call (via Claude or curl)
# list_orders: should return data or empty array

# HTTP
curl -X POST http://localhost:3333/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

### Security
```bash
# Verify no secrets in logs
docker logs sapo-mcp 2>&1 | grep -i "secret\|key\|password"
# Should return nothing

# Verify PII redaction
SAPO_LOG_LEVEL=debug npx sapo-mcp --mode=pos-online
# Call list_customers: logs should show name: "***", email: "***"

# Verify bearer auth (HTTP)
curl -X GET http://<host>:3333/health
# Should return 401 Unauthorized (if token required)

curl -X GET -H "Authorization: Bearer $TOKEN" http://<host>:3333/health
# Should return 200 OK
```

### Destructive Ops Gating
```bash
# Verify cancel_order blocked (no SAPO_ALLOW_OPS)
# Tool should be skipped or return error

# Verify cancel_order allowed (SAPO_ALLOW_OPS=cancel)
SAPO_ALLOW_OPS=cancel npx sapo-mcp --mode=pos-online
# Tool should be registered

# Verify confirm: true required
# Call cancel_order without confirm: true
# Should return error
```

### Docker
```bash
docker run --rm \
  -e SAPO_STORE=test \
  -e SAPO_API_KEY=xxx \
  -e SAPO_API_SECRET=yyy \
  -p 3333:3333 \
  sapo-mcp:latest

# In separate terminal
curl http://localhost:3333/health
# Should return 200 OK

# Check logs
docker logs <container>
# Should not show secrets
```

## Production Hardening

### Security

1. **Use SAPO_API_SECRET_FILE** (not env var)
   ```bash
   SAPO_API_SECRET_FILE=/run/secrets/sapo_secret sapo-mcp --mode=pos-online
   ```

2. **Enforce Bearer token** (if HTTP public)
   ```bash
   SAPO_HTTP_HOST=0.0.0.0 SAPO_MCP_AUTH_TOKEN=$(openssl rand -hex 32)
   ```

3. **Rotate token regularly** (e.g., weekly)
   ```bash
   # Generate new token
   NEW_TOKEN=$(openssl rand -hex 32)
   # Update deployment (K8s secret, GitHub action, etc)
   # Restart server
   ```

4. **Disable CORS by default**
   ```bash
   # Don't set SAPO_HTTP_CORS_ORIGINS unless needed
   # If needed, whitelist specific origins:
   SAPO_HTTP_CORS_ORIGINS="https://my-agent.example.com,https://goclaw.example.com"
   ```

5. **Disable PII logging** (unless debugging)
   ```bash
   # Don't set SAPO_LOG_PII=1 in production
   # Use SAPO_LOG_LEVEL=info (default, redacted)
   ```

6. **Use read-only credentials** (if Sapo supports)
   - Create separate Private App for read-only mode
   - Restrict API Key scopes to minimize blast radius

### Reliability

1. **Set reasonable timeouts**
   - Sapo API timeout: 30s hardcoded (non-configurable)
   - HTTP server request timeout: set at reverse proxy level

2. **Monitor logs**
   ```bash
   # Watch for 429 (rate limit)
   tail -f logs/sapo-mcp.log | grep "429\|rate"

   # Watch for 401 (auth failure)
   tail -f logs/sapo-mcp.log | grep "401\|Unauthorized"
   ```

3. **Session management (HTTP)**
   - Set `SAPO_HTTP_SESSION_IDLE_MS` to 30 min (default)
   - Monitor `SAPO_HTTP_MAX_SESSIONS` (default 100)
   - Alert if sessions approach cap

4. **Health check endpoint**
   ```bash
   # Check every 30s
   curl -H "Authorization: Bearer $TOKEN" http://localhost:3333/health
   # Should return 200 OK with version + session count
   ```

### Performance

1. **Set SAPO_MAX_AUTO_PAGES** wisely
   - Default 10 (safe for most)
   - Increase cautiously (memory impact)
   - Decrease if hitting timeout on analytics

2. **Use SAPO_RETRY_MAX** for flaky networks
   - Default 3 (reasonable)
   - Increase to 5 if high latency to Sapo
   - Don't exceed 10 (API timeout is 30s)

3. **Log level trade-off**
   - Production: `SAPO_LOG_LEVEL=warn` (minimal I/O)
   - Staging: `SAPO_LOG_LEVEL=info` (monitoring)
   - Debug: `SAPO_LOG_LEVEL=debug` (troubleshooting, PII risk)

## Troubleshooting

### Issue: 401 Unauthorized

**Cause:** Auth token invalid or expired

**Fix:**
```bash
# Regenerate token
NEW_TOKEN=$(openssl rand -hex 32)

# Update environment
export SAPO_MCP_AUTH_TOKEN=$NEW_TOKEN

# Restart server
docker-compose restart sapo-mcp
```

### Issue: 403 Forbidden (Sapo API)

**Cause:** Private App lacks scopes or endpoint requires OAuth

**Fix:**
1. Check Private App scopes in Sapo admin
2. For internal-only endpoints (purchase_orders, cash_transactions, etc), OAuth Partner App required (post-1.0)

### Issue: 429 Too Many Requests

**Cause:** Rate limiting (Sapo API)

**Fix:**
```bash
# Exponential backoff already implemented (1s, 2s, 4s)
# If still hitting: increase SAPO_RETRY_MAX or reduce concurrent requests

# Monitor logs
tail -f logs | grep "429"
```

### Issue: Secrets Visible in Logs

**Cause:** SAPO_LOG_PII=1 or debug logs

**Fix:**
1. Unset SAPO_LOG_PII
2. Set SAPO_LOG_LEVEL=info
3. Rotate secrets immediately

### Issue: Docker build fails

**Cause:** npm ci timeout or package missing

**Fix:**
```bash
# Rebuild with verbose output
docker build --no-cache -f examples/Dockerfile -t sapo-mcp:latest . --progress=plain

# Check node_modules
docker run --rm sapo-mcp:latest ls -la /app/node_modules/@modelcontextprotocol
```

## npm Publishing (For Maintainers)

See **RELEASE.md** (authoritative):

1. **npm login** (granular token)
   ```bash
   npm login --auth-type=web --registry=https://registry.npmjs.org
   ```

2. **npm publish** (provenance)
   ```bash
   npm publish --provenance --access public
   ```

3. **Verify published**
   ```bash
   npm view sapo-mcp@0.5.0
   npm info sapo-mcp
   ```

## Related Documentation

- **README.md** — Quick start, modes, tools, env vars
- **system-architecture.md** — Data flow, session model, middleware
- **code-standards.md** — Security, logging, secret handling
- **project-roadmap.md** — Post-1.0 features (OAuth, webhooks)
- **RELEASE.md** — Release process (npm, Docker, smoke tests, registry)
