/**
 * Tests for TransactionSchema — validates shape of real Sapo fixture
 */
import { describe, expect, it } from 'vitest';
import { TransactionListResponseSchema, TransactionSchema } from '../../src/schemas/transaction.js';
import listFixture from '../fixtures/sapo/transactions/list-response.json' with { type: 'json' };

describe('TransactionSchema', () => {
  it('parses real list fixture successfully', () => {
    const result = TransactionListResponseSchema.safeParse(listFixture);
    expect(result.success).toBe(true);
    if (!result.success) console.error(result.error.format());
  });

  it('has correct id from real fixture', () => {
    const txn = listFixture.transactions[0];
    const result = TransactionSchema.safeParse(txn);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(148295019);
      expect(result.data.order_id).toBe(174107276);
    }
  });

  it('accepts kind "sale" (from real fixture)', () => {
    const txn = listFixture.transactions[0];
    const result = TransactionSchema.safeParse(txn);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe('sale');
    }
  });

  it('accepts status "pending" (from real fixture)', () => {
    const txn = listFixture.transactions[0];
    const result = TransactionSchema.safeParse(txn);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('pending');
    }
  });

  it('accepts float amount (VND as float)', () => {
    const txn = { ...listFixture.transactions[0], amount: 150000.0 };
    const result = TransactionSchema.safeParse(txn);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(150000.0);
    }
  });

  it('uses created_on (Sapo convention)', () => {
    const txn = listFixture.transactions[0];
    const result = TransactionSchema.safeParse(txn);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.created_on).toBe('2026-04-29T19:17:27Z');
    }
  });

  it('has processed_at field (Sapo exception: uses _at for processed)', () => {
    const txn = listFixture.transactions[0];
    const result = TransactionSchema.safeParse(txn);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.processed_at).toBe('2026-04-29T19:17:27Z');
    }
  });

  it('has test: false (sandbox marker)', () => {
    const txn = listFixture.transactions[0];
    const result = TransactionSchema.safeParse(txn);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.test).toBe(false);
    }
  });

  it('passes through unknown fields', () => {
    const txn = { ...listFixture.transactions[0], extra_field: 'drift' };
    const result = TransactionSchema.safeParse(txn);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).extra_field).toBe('drift');
    }
  });

  it('requires id', () => {
    const { id: _id, ...withoutId } = listFixture.transactions[0];
    const result = TransactionSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
  });

  it('requires order_id', () => {
    const { order_id: _oid, ...withoutOrderId } = listFixture.transactions[0];
    const result = TransactionSchema.safeParse(withoutOrderId);
    expect(result.success).toBe(false);
  });

  it('requires created_on', () => {
    const { created_on: _c, ...withoutCreated } = listFixture.transactions[0];
    const result = TransactionSchema.safeParse(withoutCreated);
    expect(result.success).toBe(false);
  });

  it('rejects invalid kind enum', () => {
    const txn = { ...listFixture.transactions[0], kind: 'invalid' };
    const result = TransactionSchema.safeParse(txn);
    expect(result.success).toBe(false);
  });
});
