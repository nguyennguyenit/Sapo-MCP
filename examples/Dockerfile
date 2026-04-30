# sapo-mcp Streamable HTTP transport — multi-stage build
# Build: docker build -f examples/Dockerfile -t sapo-mcp:local .
# Run:   docker run --rm -p 3333:3333 \
#          -e SAPO_STORE=mystore \
#          -e SAPO_API_KEY=xxx -e SAPO_API_SECRET=yyy \
#          -e SAPO_HTTP_HOST=0.0.0.0 \
#          -e SAPO_MCP_AUTH_TOKEN=secret \
#          sapo-mcp:local

# ---- Stage 1: build ---------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json tsup.config.ts biome.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- Stage 2: runtime -------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
# Run as non-root
RUN addgroup -S sapo && adduser -S sapo -G sapo
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
USER sapo
EXPOSE 3333
ENV SAPO_HTTP_HOST=0.0.0.0
ENV SAPO_HTTP_PORT=3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3333/health || exit 1
CMD ["node", "dist/index.mjs", "--mode=pos-online", "--transport=http", "--port=3333"]
