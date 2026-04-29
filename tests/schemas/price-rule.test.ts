/**
 * Tests for PriceRuleSchema — validates shape of real Sapo fixture
 */
import { describe, expect, it } from 'vitest';
import {
  PriceRuleAllocationMethodEnum,
  PriceRuleCustomerSelectionEnum,
  PriceRuleListResponseSchema,
  PriceRuleSchema,
  PriceRuleSingleResponseSchema,
  PriceRuleStatusEnum,
  PriceRuleTargetSelectionEnum,
  PriceRuleTargetTypeEnum,
  PriceRuleValueTypeEnum,
} from '../../src/schemas/price-rule.js';
import listFixture from '../fixtures/sapo/price-rules/list-response.json' with { type: 'json' };
import singleFixture from '../fixtures/sapo/price-rules/single.json' with { type: 'json' };

describe('PriceRuleSchema', () => {
  it('parses real single fixture successfully', () => {
    const result = PriceRuleSingleResponseSchema.safeParse(singleFixture);
    expect(result.success).toBe(true);
    if (!result.success) console.error(result.error.format());
  });

  it('parses real list fixture successfully', () => {
    const result = PriceRuleListResponseSchema.safeParse(listFixture);
    expect(result.success).toBe(true);
  });

  it('extracts correct id from real fixture', () => {
    const result = PriceRuleSchema.safeParse(singleFixture.price_rule);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.id).toBe(2168108);
  });

  it('extracts value as STRING "-10.0" (not a number) from real fixture', () => {
    const result = PriceRuleSchema.safeParse(singleFixture.price_rule);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.value).toBe('-10.0');
      expect(typeof result.data.value).toBe('string');
    }
  });

  it('extracts value_type "percentage" from real fixture', () => {
    const result = PriceRuleSchema.safeParse(singleFixture.price_rule);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.value_type).toBe('percentage');
  });

  it('extracts target_type "line_item" from real fixture', () => {
    const result = PriceRuleSchema.safeParse(singleFixture.price_rule);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.target_type).toBe('line_item');
  });

  it('extracts target_selection "all" from real fixture', () => {
    const result = PriceRuleSchema.safeParse(singleFixture.price_rule);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.target_selection).toBe('all');
  });

  it('extracts allocation_method "across" from real fixture', () => {
    const result = PriceRuleSchema.safeParse(singleFixture.price_rule);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.allocation_method).toBe('across');
  });

  it('extracts customer_selection "all" from real fixture', () => {
    const result = PriceRuleSchema.safeParse(singleFixture.price_rule);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.customer_selection).toBe('all');
  });

  it('uses created_on / modified_on (not _at) from real fixture', () => {
    const result = PriceRuleSchema.safeParse(singleFixture.price_rule);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.created_on).toBe('2026-04-29T19:33:12Z');
      expect(result.data.modified_on).toBe('2026-04-29T19:33:12Z');
    }
  });

  it('extracts status "active" from real fixture', () => {
    const result = PriceRuleSchema.safeParse(singleFixture.price_rule);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe('active');
  });

  it('accepts all PriceRuleValueTypeEnum values', () => {
    for (const v of ['percentage', 'fixed_amount', 'shipping']) {
      expect(PriceRuleValueTypeEnum.safeParse(v).success).toBe(true);
    }
  });

  it('accepts all PriceRuleTargetTypeEnum values', () => {
    for (const v of ['line_item', 'shipping_line']) {
      expect(PriceRuleTargetTypeEnum.safeParse(v).success).toBe(true);
    }
  });

  it('accepts all PriceRuleTargetSelectionEnum values', () => {
    for (const v of ['all', 'entitled']) {
      expect(PriceRuleTargetSelectionEnum.safeParse(v).success).toBe(true);
    }
  });

  it('accepts all PriceRuleAllocationMethodEnum values', () => {
    for (const v of ['across', 'each']) {
      expect(PriceRuleAllocationMethodEnum.safeParse(v).success).toBe(true);
    }
  });

  it('accepts all PriceRuleCustomerSelectionEnum values', () => {
    for (const v of ['all', 'prerequisite']) {
      expect(PriceRuleCustomerSelectionEnum.safeParse(v).success).toBe(true);
    }
  });

  it('accepts all PriceRuleStatusEnum values', () => {
    for (const v of ['active', 'archived', 'scheduled']) {
      expect(PriceRuleStatusEnum.safeParse(v).success).toBe(true);
    }
  });

  it('passes through optional fields like combines_with', () => {
    const result = PriceRuleSchema.safeParse(singleFixture.price_rule);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.combines_with).toMatchObject({
        order_discount: true,
        product_discount: true,
        shipping_discount: true,
      });
    }
  });

  it('rejects missing required id', () => {
    const bad = { ...singleFixture.price_rule, id: undefined };
    expect(PriceRuleSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects number for value field (must be string)', () => {
    const bad = { ...singleFixture.price_rule, value: -10.0 };
    expect(PriceRuleSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects missing required value_type', () => {
    const bad = { ...singleFixture.price_rule, value_type: undefined };
    expect(PriceRuleSchema.safeParse(bad).success).toBe(false);
  });
});
