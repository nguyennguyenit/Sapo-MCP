/**
 * Tests for PosShiftSchema (UNDOC endpoint, verified 2026-04-30)
 * Fixtures: stub — replace with real capture from `npm run capture:fixtures` before 0.2.0 publish.
 */
import { describe, expect, it } from 'vitest';
import {
  PosShiftListResponseSchema,
  PosShiftSchema,
  PosShiftSingleResponseSchema,
} from '../../src/schemas/pos-shift.js';
import listFixture from '../fixtures/sapo/pos-shifts/list.json' with { type: 'json' };
import singleFixture from '../fixtures/sapo/pos-shifts/single.json' with { type: 'json' };

describe('PosShiftSchema', () => {
  it('parses a closed shift from list fixture', () => {
    const result = PosShiftSchema.safeParse(listFixture.pos_shifts[0]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(40001);
      expect(result.data.status).toBe('closed');
    }
  });

  it('parses an open shift with null closing_amount', () => {
    const result = PosShiftSchema.safeParse(listFixture.pos_shifts[1]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('open');
      expect(result.data.closing_amount).toBeNull();
    }
  });

  it('requires id', () => {
    const result = PosShiftSchema.safeParse({ status: 'open' });
    expect(result.success).toBe(false);
  });

  it('passes through unknown fields', () => {
    const result = PosShiftSchema.safeParse({ id: 1, cashier_id: 999 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).cashier_id).toBe(999);
    }
  });
});

describe('PosShiftSingleResponseSchema', () => {
  it('parses single fixture', () => {
    const result = PosShiftSingleResponseSchema.safeParse(singleFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pos_shift.id).toBe(40001);
    }
  });

  it('rejects missing pos_shift wrapper', () => {
    const result = PosShiftSingleResponseSchema.safeParse({ id: 1 });
    expect(result.success).toBe(false);
  });
});

describe('PosShiftListResponseSchema', () => {
  it('parses list fixture', () => {
    const result = PosShiftListResponseSchema.safeParse(listFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pos_shifts).toHaveLength(2);
    }
  });

  it('parses empty list', () => {
    const result = PosShiftListResponseSchema.safeParse({ pos_shifts: [] });
    expect(result.success).toBe(true);
  });
});
