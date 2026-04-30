/**
 * Tests for RefundSchema — verified against live fixture from order #1001
 * captured 2026-04-30 on store giapducthangscs.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  RefundListResponseSchema,
  RefundSingleResponseSchema,
  RefundSchema,
} from '../../src/schemas/refund.js';

const fixtureDir = join(__dirname, '../fixtures/sapo/refunds');

describe('RefundSchema', () => {
  it('parses live single refund fixture', () => {
    const raw = JSON.parse(readFileSync(join(fixtureDir, 'single.json'), 'utf-8'));
    const parsed = RefundSingleResponseSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const refund = parsed.data.refund;
      expect(refund.id).toBe(25412855);
      expect(refund.order_id).toBe(174107276);
      expect(refund.return_id).toBeNull();
      expect(refund.total_refunded).toBe(150000);
      expect(refund.transactions?.[0]?.kind).toBe('refund');
      expect(refund.order_adjustments?.[0]?.kind).toBe('refund_discrepancy');
    }
  });

  it('parses live list refunds fixture', () => {
    const raw = JSON.parse(readFileSync(join(fixtureDir, 'list.json'), 'utf-8'));
    const parsed = RefundListResponseSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(Array.isArray(parsed.data.refunds)).toBe(true);
      expect(parsed.data.refunds.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('accepts refund with empty transactions and refund_line_items (ghost refund)', () => {
    const ghost = {
      id: 1,
      order_id: 2,
      return_id: null,
      created_on: '2026-01-01T00:00:00Z',
      restock: false,
      transactions: [],
      refund_line_items: [],
      total_refunded: 0,
    };
    const parsed = RefundSchema.safeParse(ghost);
    expect(parsed.success).toBe(true);
  });

  it('rejects missing required id', () => {
    const bad = { order_id: 1, created_on: '2026-01-01T00:00:00Z' };
    const parsed = RefundSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
  });
});
