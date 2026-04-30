/**
 * Tests for ScriptTagSchema.
 *
 * Key Sapo conventions tested:
 * - Timestamps: created_on / modified_on (NOT created_at / updated_at)
 * - .passthrough() — unknown fields preserved
 * - event enum ('onload')
 * - display_scope enum values
 */
import { describe, expect, it } from 'vitest';
import {
  ScriptTagListResponseSchema,
  ScriptTagSchema,
  ScriptTagSingleResponseSchema,
} from '../../src/schemas/script-tag.js';

const baseScriptTag = {
  id: 20001,
  src: 'https://cdn.example.com/analytics.js',
  event: 'onload' as const,
  display_scope: 'all' as const,
  created_on: '2026-01-10T08:00:00Z',
  modified_on: '2026-04-01T09:00:00Z',
};

describe('ScriptTagSchema', () => {
  it('parses a complete script tag', () => {
    const result = ScriptTagSchema.safeParse(baseScriptTag);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(20001);
      expect(result.data.src).toBe('https://cdn.example.com/analytics.js');
    }
  });

  it('parses a minimal script tag (only required fields)', () => {
    const minimal = {
      id: 20001,
      src: 'https://cdn.example.com/analytics.js',
      created_on: '2026-01-10T08:00:00Z',
      modified_on: '2026-04-01T09:00:00Z',
    };
    const result = ScriptTagSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('uses created_on NOT created_at (Sapo convention)', () => {
    const result = ScriptTagSchema.safeParse(baseScriptTag);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.created_on).toBe('2026-01-10T08:00:00Z');
      expect(result.data.modified_on).toBe('2026-04-01T09:00:00Z');
      expect((result.data as Record<string, unknown>).created_at).toBeUndefined();
    }
  });

  it('requires id, src, created_on, modified_on', () => {
    const { id: _id, ...without } = baseScriptTag;
    expect(ScriptTagSchema.safeParse(without).success).toBe(false);
  });

  it('accepts onload as event value', () => {
    const result = ScriptTagSchema.safeParse({ ...baseScriptTag, event: 'onload' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid event value', () => {
    const result = ScriptTagSchema.safeParse({ ...baseScriptTag, event: 'onclick' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid display_scope values', () => {
    for (const scope of ['online_store', 'order_status', 'all'] as const) {
      const result = ScriptTagSchema.safeParse({ ...baseScriptTag, display_scope: scope });
      expect(result.success, `display_scope "${scope}" should be valid`).toBe(true);
    }
  });

  it('rejects invalid display_scope value', () => {
    const result = ScriptTagSchema.safeParse({ ...baseScriptTag, display_scope: 'checkout' });
    expect(result.success).toBe(false);
  });

  it('accepts nullable display_scope', () => {
    const result = ScriptTagSchema.safeParse({ ...baseScriptTag, display_scope: null });
    expect(result.success).toBe(true);
  });

  it('passes through unknown fields', () => {
    const withExtra = { ...baseScriptTag, custom_field: 'web-batch-c' };
    const result = ScriptTagSchema.parse(withExtra);
    expect((result as Record<string, unknown>).custom_field).toBe('web-batch-c');
  });

  it('defaults event to onload when omitted', () => {
    const { event: _e, ...without } = baseScriptTag;
    const result = ScriptTagSchema.safeParse(without);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event).toBe('onload');
    }
  });
});

describe('ScriptTagSingleResponseSchema', () => {
  it('parses wrapped single response', () => {
    const result = ScriptTagSingleResponseSchema.safeParse({ script_tag: baseScriptTag });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.script_tag.id).toBe(20001);
    }
  });

  it('rejects missing script_tag wrapper', () => {
    const result = ScriptTagSingleResponseSchema.safeParse(baseScriptTag);
    expect(result.success).toBe(false);
  });
});

describe('ScriptTagListResponseSchema', () => {
  it('parses list response', () => {
    const result = ScriptTagListResponseSchema.safeParse({ script_tags: [baseScriptTag] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.script_tags).toHaveLength(1);
    }
  });

  it('parses empty list', () => {
    const result = ScriptTagListResponseSchema.safeParse({ script_tags: [] });
    expect(result.success).toBe(true);
  });
});
