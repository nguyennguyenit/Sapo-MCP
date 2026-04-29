/**
 * Tests for src/client/auth.ts
 * Covers: Basic auth header format, credential masking for logs
 */
import { describe, expect, it } from 'vitest';
import { buildBasicAuthHeader, maskAuthHeader } from '../../src/client/auth.js';

describe('buildBasicAuthHeader', () => {
  it('produces correct Basic Auth header format', () => {
    const header = buildBasicAuthHeader('mykey', 'mysecret');
    expect(header).toMatch(/^Basic [A-Za-z0-9+/]+=*$/);
  });

  it('encodes key:secret as base64', () => {
    const header = buildBasicAuthHeader('mykey', 'mysecret');
    const token = header.replace('Basic ', '');
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    expect(decoded).toBe('mykey:mysecret');
  });

  it('handles special characters in key/secret', () => {
    const header = buildBasicAuthHeader('key!@#', 'secret$%^');
    const token = header.replace('Basic ', '');
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    expect(decoded).toBe('key!@#:secret$%^');
  });

  it('starts with "Basic " prefix', () => {
    const header = buildBasicAuthHeader('k', 's');
    expect(header.startsWith('Basic ')).toBe(true);
  });
});

describe('maskAuthHeader', () => {
  it('masks Basic auth token with ***', () => {
    const header = buildBasicAuthHeader('mykey', 'mysecret');
    const masked = maskAuthHeader(header);
    expect(masked).toBe('Basic ***');
  });

  it('does not reveal the original token', () => {
    const header = buildBasicAuthHeader('mykey', 'mysecret');
    const masked = maskAuthHeader(header);
    const token = header.replace('Basic ', '');
    expect(masked).not.toContain(token);
  });

  it('handles non-Basic auth header unchanged', () => {
    const header = 'Bearer some-token';
    const masked = maskAuthHeader(header);
    expect(masked).toBe('Bearer some-token');
  });

  it('handles case-insensitive Basic prefix', () => {
    const masked = maskAuthHeader('basic dGVzdDp0ZXN0');
    expect(masked).toBe('Basic ***');
  });
});
