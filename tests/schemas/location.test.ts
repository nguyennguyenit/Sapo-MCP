/**
 * Tests for LocationSchema (UNDOC endpoint, verified 2026-04-30)
 */
import { describe, expect, it } from 'vitest';
import {
  LocationListResponseSchema,
  LocationSchema,
  LocationSingleResponseSchema,
} from '../../src/schemas/location.js';
import listFixture from '../fixtures/sapo/locations/list.json' with { type: 'json' };
import singleFixture from '../fixtures/sapo/locations/single.json' with { type: 'json' };

describe('LocationSchema', () => {
  it('parses a valid location', () => {
    const result = LocationSchema.safeParse(listFixture.locations[0]);
    expect(result.success).toBe(true);
  });

  it('requires id and name', () => {
    const result = LocationSchema.safeParse({ active: true });
    expect(result.success).toBe(false);
  });

  it('allows optional address fields', () => {
    const result = LocationSchema.safeParse({ id: 1, name: 'Test', active: true });
    expect(result.success).toBe(true);
  });

  it('passes through unknown fields', () => {
    const result = LocationSchema.safeParse({
      id: 1,
      name: 'Test',
      unknown_field: 'value',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).unknown_field).toBe('value');
    }
  });
});

describe('LocationSingleResponseSchema', () => {
  it('parses single fixture', () => {
    const result = LocationSingleResponseSchema.safeParse(singleFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.location.id).toBe(10001);
    }
  });

  it('rejects missing location wrapper', () => {
    const result = LocationSingleResponseSchema.safeParse({ id: 1 });
    expect(result.success).toBe(false);
  });
});

describe('LocationListResponseSchema', () => {
  it('parses list fixture', () => {
    const result = LocationListResponseSchema.safeParse(listFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.locations).toHaveLength(2);
    }
  });

  it('parses empty list', () => {
    const result = LocationListResponseSchema.safeParse({ locations: [] });
    expect(result.success).toBe(true);
  });
});
