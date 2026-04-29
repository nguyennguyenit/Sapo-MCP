/**
 * Unit tests for probe-shared utilities.
 * Tests: store guard, auth header builder, masked logger.
 */
import { describe, expect, it } from 'vitest';

import {
  assertWriteSafeStore,
  buildBasicAuthHeader,
  maskCredentials,
} from '../../scripts/probe-shared.js';

describe('assertWriteSafeStore', () => {
  it('passes for store name containing "test"', () => {
    expect(() => assertWriteSafeStore('myshop-test')).not.toThrow();
    expect(() => assertWriteSafeStore('shop-test')).not.toThrow();
    expect(() => assertWriteSafeStore('TEST-store')).not.toThrow();
    expect(() => assertWriteSafeStore('testshop')).not.toThrow();
  });

  it('passes for store name containing "dev"', () => {
    expect(() => assertWriteSafeStore('myshop-dev')).not.toThrow();
    expect(() => assertWriteSafeStore('dev-shop')).not.toThrow();
    expect(() => assertWriteSafeStore('devstore')).not.toThrow();
  });

  it('passes for store name containing "sandbox"', () => {
    expect(() => assertWriteSafeStore('mysandbox')).not.toThrow();
    expect(() => assertWriteSafeStore('shop-sandbox')).not.toThrow();
    expect(() => assertWriteSafeStore('SANDBOX-test')).not.toThrow();
  });

  it('throws for plain production store name', () => {
    expect(() => assertWriteSafeStore('myshop')).toThrow(/production/i);
    expect(() => assertWriteSafeStore('acmecorp')).toThrow(/production/i);
    expect(() => assertWriteSafeStore('livestore')).toThrow(/production/i);
  });

  it('throws with store name in error message', () => {
    expect(() => assertWriteSafeStore('myshop')).toThrow('myshop');
  });
});

describe('buildBasicAuthHeader', () => {
  it('returns correct Basic auth format', () => {
    const header = buildBasicAuthHeader('apikey123', 'apisecret456');
    const expected = `Basic ${Buffer.from('apikey123:apisecret456').toString('base64')}`;
    expect(header).toBe(expected);
  });

  it('includes key and secret separated by colon in base64', () => {
    const header = buildBasicAuthHeader('k', 's');
    const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString('utf8');
    expect(decoded).toBe('k:s');
  });

  it('returns string starting with "Basic "', () => {
    const header = buildBasicAuthHeader('x', 'y');
    expect(header.startsWith('Basic ')).toBe(true);
  });
});

describe('maskCredentials', () => {
  it('replaces apiKey in string with ***', () => {
    const result = maskCredentials('Error: myapikey failed', 'myapikey', 'mysecret');
    expect(result).not.toContain('myapikey');
    expect(result).toContain('***');
  });

  it('replaces apiSecret in string with ***', () => {
    const result = maskCredentials('Token: mysecret is invalid', 'myapikey', 'mysecret');
    expect(result).not.toContain('mysecret');
    expect(result).toContain('***');
  });

  it('replaces both credentials', () => {
    const result = maskCredentials('key=myapikey secret=mysecret', 'myapikey', 'mysecret');
    expect(result).not.toContain('myapikey');
    expect(result).not.toContain('mysecret');
  });

  it('leaves string unchanged when no credentials present', () => {
    const result = maskCredentials('normal error message', 'myapikey', 'mysecret');
    expect(result).toBe('normal error message');
  });
});
