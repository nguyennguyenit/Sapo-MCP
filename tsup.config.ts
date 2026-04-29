import { chmodSync } from 'node:fs';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  target: 'node20',
  dts: false, // excluded from main build budget; run separately if needed
  sourcemap: true,
  clean: true,
  splitting: false,
  bundle: true,
  minify: false,
  // Keep MCP SDK and zod external to avoid bundling large deps
  external: ['@modelcontextprotocol/sdk', 'zod'],
  outDir: 'dist',
  outExtension: () => ({ js: '.mjs' }),
  banner: {
    js: '#!/usr/bin/env node',
  },
  onSuccess: async () => {
    // Ensure the output binary is executable
    try {
      chmodSync('dist/index.mjs', 0o755);
    } catch {
      // Non-fatal: may fail on Windows
    }
    console.error('Build complete: dist/index.mjs');
  },
});
