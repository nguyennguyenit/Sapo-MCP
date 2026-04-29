/**
 * Tests for src/config.ts
 * Covers: ENV validation, SAPO_ALLOW_OPS parsing, credentials file fallback
 */
import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const VALID_ENV = {
  SAPO_STORE: 'testshop',
  SAPO_API_KEY: 'test-key',
  SAPO_API_SECRET: 'test-secret',
};

describe('loadConfig', () => {
  describe('required fields', () => {
    it('throws with field list when SAPO_STORE is missing', () => {
      const env = { SAPO_API_KEY: 'key', SAPO_API_SECRET: 'secret' };
      expect(() => loadConfig(env)).toThrow('SAPO_STORE');
    });

    it('throws when SAPO_API_KEY is missing', () => {
      const env = { SAPO_STORE: 'shop', SAPO_API_SECRET: 'secret' };
      expect(() => loadConfig(env)).toThrow('SAPO_API_KEY');
    });

    it('throws when neither SAPO_API_SECRET nor SAPO_API_SECRET_FILE provided', () => {
      const env = { SAPO_STORE: 'shop', SAPO_API_KEY: 'key' };
      expect(() => loadConfig(env)).toThrow(/SAPO_API_SECRET/);
    });

    it('throws listing all missing required fields at once', () => {
      expect(() => loadConfig({})).toThrow('Sapo MCP configuration errors');
    });
  });

  describe('valid minimal config', () => {
    it('returns parsed config with defaults', () => {
      const config = loadConfig(VALID_ENV);
      expect(config.store).toBe('testshop');
      expect(config.apiKey).toBe('test-key');
      expect(config.apiSecret).toBe('test-secret');
      expect(config.maxAutoPages).toBe(10);
      expect(config.retryMax).toBe(3);
      expect(config.logLevel).toBe('info');
      expect(config.logPii).toBe(false);
      expect(config.allowOps.size).toBe(0);
    });
  });

  describe('SAPO_ALLOW_OPS parsing', () => {
    it('returns empty set when SAPO_ALLOW_OPS is empty (default)', () => {
      const config = loadConfig(VALID_ENV);
      expect(config.allowOps.size).toBe(0);
    });

    it('parses single category', () => {
      const config = loadConfig({ ...VALID_ENV, SAPO_ALLOW_OPS: 'cancel' });
      expect(config.allowOps.has('cancel')).toBe(true);
      expect(config.allowOps.size).toBe(1);
    });

    it('parses comma-separated categories', () => {
      const config = loadConfig({ ...VALID_ENV, SAPO_ALLOW_OPS: 'cancel,delete,inventory_set' });
      expect(config.allowOps.has('cancel')).toBe(true);
      expect(config.allowOps.has('delete')).toBe(true);
      expect(config.allowOps.has('inventory_set')).toBe(true);
      expect(config.allowOps.size).toBe(3);
    });

    it('parses wildcard "*"', () => {
      const config = loadConfig({ ...VALID_ENV, SAPO_ALLOW_OPS: '*' });
      expect(config.allowOps.has('*')).toBe(true);
    });

    it('handles whitespace in CSV', () => {
      const config = loadConfig({ ...VALID_ENV, SAPO_ALLOW_OPS: ' cancel , delete ' });
      expect(config.allowOps.has('cancel')).toBe(true);
      expect(config.allowOps.has('delete')).toBe(true);
    });

    it('throws on invalid category name', () => {
      expect(() => loadConfig({ ...VALID_ENV, SAPO_ALLOW_OPS: 'invalid_op' })).toThrow(
        'Invalid SAPO_ALLOW_OPS value: "invalid_op"',
      );
    });
  });

  describe('SAPO_API_SECRET_FILE', () => {
    let tmpFile: string;

    beforeEach(() => {
      tmpFile = join(tmpdir(), `sapo-test-secret-${Date.now()}.txt`);
    });

    afterEach(() => {
      try {
        unlinkSync(tmpFile);
      } catch {
        // Ignore if already removed
      }
    });

    it('reads secret from file when SAPO_API_SECRET_FILE is set', () => {
      writeFileSync(tmpFile, 'secret-from-file\n');
      const config = loadConfig({
        SAPO_STORE: 'shop',
        SAPO_API_KEY: 'key',
        SAPO_API_SECRET_FILE: tmpFile,
      });
      expect(config.apiSecret).toBe('secret-from-file');
    });

    it('file secret takes precedence over SAPO_API_SECRET', () => {
      writeFileSync(tmpFile, 'file-wins');
      const config = loadConfig({
        ...VALID_ENV,
        SAPO_API_SECRET_FILE: tmpFile,
        SAPO_API_SECRET: 'should-be-ignored',
      });
      expect(config.apiSecret).toBe('file-wins');
    });

    it('throws when file does not exist', () => {
      expect(() =>
        loadConfig({
          SAPO_STORE: 'shop',
          SAPO_API_KEY: 'key',
          SAPO_API_SECRET_FILE: '/nonexistent/path/secret.txt',
        }),
      ).toThrow('Failed to read SAPO_API_SECRET_FILE');
    });
  });

  describe('optional config overrides', () => {
    it('parses SAPO_MAX_AUTO_PAGES', () => {
      const config = loadConfig({ ...VALID_ENV, SAPO_MAX_AUTO_PAGES: '5' });
      expect(config.maxAutoPages).toBe(5);
    });

    it('parses SAPO_RETRY_MAX', () => {
      const config = loadConfig({ ...VALID_ENV, SAPO_RETRY_MAX: '0' });
      expect(config.retryMax).toBe(0);
    });

    it('parses SAPO_LOG_LEVEL', () => {
      const config = loadConfig({ ...VALID_ENV, SAPO_LOG_LEVEL: 'debug' });
      expect(config.logLevel).toBe('debug');
    });

    it('throws on invalid SAPO_LOG_LEVEL', () => {
      expect(() => loadConfig({ ...VALID_ENV, SAPO_LOG_LEVEL: 'verbose' })).toThrow();
    });

    it('parses SAPO_LOG_PII=1 as true', () => {
      const config = loadConfig({ ...VALID_ENV, SAPO_LOG_PII: '1' });
      expect(config.logPii).toBe(true);
    });

    it('parses SAPO_LOG_PII=true as true (case-insensitive)', () => {
      expect(loadConfig({ ...VALID_ENV, SAPO_LOG_PII: 'true' }).logPii).toBe(true);
      expect(loadConfig({ ...VALID_ENV, SAPO_LOG_PII: 'TRUE' }).logPii).toBe(true);
    });

    it('parses SAPO_LOG_PII=0/false/empty as false (strict opt-in)', () => {
      // Critical: "0" must NOT enable PII logging
      expect(loadConfig({ ...VALID_ENV, SAPO_LOG_PII: '0' }).logPii).toBe(false);
      expect(loadConfig({ ...VALID_ENV, SAPO_LOG_PII: 'false' }).logPii).toBe(false);
      expect(loadConfig({ ...VALID_ENV, SAPO_LOG_PII: 'no' }).logPii).toBe(false);
      expect(loadConfig({ ...VALID_ENV, SAPO_LOG_PII: '' }).logPii).toBe(false);
    });
  });
});
