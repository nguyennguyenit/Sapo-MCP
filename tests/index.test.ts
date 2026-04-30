/**
 * Tests for src/index.ts — CLI pure-function exports
 * Covers: buildHelpText content, readPackageVersion format
 *
 * Note: main() is not directly testable without process mocking at depth.
 * The critical paths (config errors, mode errors) are covered by config.test.ts
 * and modes/registry.test.ts. Here we focus on the exported pure functions.
 */
import { describe, expect, it } from 'vitest';
import { buildHelpText, readPackageVersion } from '../src/index.js';

describe('buildHelpText', () => {
  it('contains --mode flag documentation', () => {
    const help = buildHelpText();
    expect(help).toContain('--mode=');
  });

  it('contains --transport flag documentation', () => {
    const help = buildHelpText();
    expect(help).toContain('--transport=');
  });

  it('lists valid mode values', () => {
    const help = buildHelpText();
    expect(help).toContain('pos-online');
    expect(help).toContain('web');
    expect(help).toContain('analytics');
    expect(help).toContain('pos-counter');
  });

  it('lists valid transport values', () => {
    const help = buildHelpText();
    expect(help).toContain('stdio');
  });

  it('includes usage line', () => {
    const help = buildHelpText();
    expect(help).toContain('Usage:');
  });

  it('includes --help and --version flags', () => {
    const help = buildHelpText();
    expect(help).toContain('--help');
    expect(help).toContain('--version');
  });

  it('includes required ENV variables', () => {
    const help = buildHelpText();
    expect(help).toContain('SAPO_STORE');
    expect(help).toContain('SAPO_API_KEY');
    expect(help).toContain('SAPO_API_SECRET');
  });

  it('includes example invocation', () => {
    const help = buildHelpText();
    expect(help).toContain('sapo-mcp --mode=pos-online');
  });

  it('returns a non-empty string', () => {
    const help = buildHelpText();
    expect(typeof help).toBe('string');
    expect(help.length).toBeGreaterThan(100);
  });
});

describe('readPackageVersion', () => {
  it('returns a semver-like string', () => {
    const version = readPackageVersion();
    // Must be x.y.z or fallback '0.0.0'
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('returns the version from package.json or "0.0.0" as fallback', () => {
    const version = readPackageVersion();
    // Accept any semver; just verify it is not empty or undefined
    expect(version).toBeTruthy();
  });
});
