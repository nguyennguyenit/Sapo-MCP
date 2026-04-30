/**
 * Tests for StockTransferSchema (UNDOC endpoint, verified 2026-04-30)
 * Fixtures: stub — replace with real capture from `npm run capture:fixtures` before 0.2.0 publish.
 */
import { describe, expect, it } from 'vitest';
import {
  StockTransferListResponseSchema,
  StockTransferSchema,
  StockTransferSingleResponseSchema,
} from '../../src/schemas/stock-transfer.js';
import listFixture from '../fixtures/sapo/stock-transfers/list.json' with { type: 'json' };
import singleFixture from '../fixtures/sapo/stock-transfers/single.json' with { type: 'json' };

describe('StockTransferSchema', () => {
  it('parses a completed transfer from list fixture', () => {
    const result = StockTransferSchema.safeParse(listFixture.stock_transfers[0]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(50001);
      expect(result.data.status).toBe('completed');
      expect(result.data.from_location_id).toBe(10001);
      expect(result.data.to_location_id).toBe(10002);
    }
  });

  it('parses a pending transfer with null note', () => {
    const result = StockTransferSchema.safeParse(listFixture.stock_transfers[1]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('pending');
      expect(result.data.note).toBeNull();
    }
  });

  it('requires id', () => {
    const result = StockTransferSchema.safeParse({ status: 'pending' });
    expect(result.success).toBe(false);
  });

  it('passes through unknown fields', () => {
    const result = StockTransferSchema.safeParse({ id: 1, line_items: [] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).line_items).toEqual([]);
    }
  });

  it('uses created_on / modified_on (Sapo convention)', () => {
    const result = StockTransferSchema.safeParse({
      id: 1,
      created_on: '2024-01-01T00:00:00Z',
      modified_on: '2024-01-01T00:00:00Z',
    });
    expect(result.success).toBe(true);
  });
});

describe('StockTransferSingleResponseSchema', () => {
  it('parses single fixture', () => {
    const result = StockTransferSingleResponseSchema.safeParse(singleFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stock_transfer.id).toBe(50001);
    }
  });

  it('rejects missing stock_transfer wrapper', () => {
    const result = StockTransferSingleResponseSchema.safeParse({ id: 1 });
    expect(result.success).toBe(false);
  });
});

describe('StockTransferListResponseSchema', () => {
  it('parses list fixture', () => {
    const result = StockTransferListResponseSchema.safeParse(listFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stock_transfers).toHaveLength(2);
    }
  });

  it('parses empty list', () => {
    const result = StockTransferListResponseSchema.safeParse({ stock_transfers: [] });
    expect(result.success).toBe(true);
  });
});
