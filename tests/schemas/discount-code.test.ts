/**
 * Tests for DiscountCodeSchema — validates shape of real Sapo fixture
 */
import { describe, expect, it } from 'vitest';
import {
  DiscountCodeListResponseSchema,
  DiscountCodeSchema,
  DiscountCodeSingleResponseSchema,
} from '../../src/schemas/discount-code.js';
import listFixture from '../fixtures/sapo/discount-codes/list-response.json' with { type: 'json' };

const singleFixture = { discount_code: listFixture.discount_codes[0] };

describe('DiscountCodeSchema', () => {
  it('parses real list fixture successfully', () => {
    const result = DiscountCodeListResponseSchema.safeParse(listFixture);
    expect(result.success).toBe(true);
    if (!result.success) console.error(result.error.format());
  });

  it('parses synthetic single fixture successfully', () => {
    const result = DiscountCodeSingleResponseSchema.safeParse(singleFixture);
    expect(result.success).toBe(true);
  });

  it('extracts correct id from real fixture', () => {
    const result = DiscountCodeSchema.safeParse(listFixture.discount_codes[0]);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.id).toBe(3315351);
  });

  it('extracts code from real fixture', () => {
    const result = DiscountCodeSchema.safeParse(listFixture.discount_codes[0]);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.code).toBe('TESTPROBE_DELETE');
  });

  it('extracts usage_count 0 from real fixture', () => {
    const result = DiscountCodeSchema.safeParse(listFixture.discount_codes[0]);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.usage_count).toBe(0);
  });

  it('uses created_on / modified_on timestamps from real fixture', () => {
    const result = DiscountCodeSchema.safeParse(listFixture.discount_codes[0]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.created_on).toBe('2026-04-29T19:33:13Z');
      expect(result.data.modified_on).toBe('2026-04-29T19:33:13Z');
    }
  });

  it('accepts optional price_rule_id field', () => {
    const withPriceRule = { ...listFixture.discount_codes[0], price_rule_id: 2168108 };
    const result = DiscountCodeSchema.safeParse(withPriceRule);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.price_rule_id).toBe(2168108);
  });

  it('passes through unknown fields via passthrough', () => {
    const withExtra = { ...listFixture.discount_codes[0], extra_field: 'test' };
    const result = DiscountCodeSchema.safeParse(withExtra);
    expect(result.success).toBe(true);
  });

  it('rejects missing required id', () => {
    const bad = { ...listFixture.discount_codes[0], id: undefined };
    expect(DiscountCodeSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects missing required code', () => {
    const bad = { ...listFixture.discount_codes[0], code: undefined };
    expect(DiscountCodeSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects missing required created_on', () => {
    const bad = { ...listFixture.discount_codes[0], created_on: undefined };
    expect(DiscountCodeSchema.safeParse(bad).success).toBe(false);
  });
});
