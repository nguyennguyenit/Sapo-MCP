/**
 * Tests for InventoryLevelSchema — Sapo Inventory Level resource.
 * Fixture is REAL captured data from store giapducthangscs (2026-04-30).
 */
import { describe, expect, it } from 'vitest';
import {
  InventoryLevelListResponseSchema,
  InventoryLevelSchema,
} from '../../src/schemas/inventory.js';
import listFixture from '../fixtures/sapo/inventory/list-response.json' with { type: 'json' };

const validLevel = listFixture.inventory_levels[0];

describe('InventoryLevelSchema', () => {
  it('parses a real Sapo inventory level response', () => {
    const result = InventoryLevelSchema.safeParse(validLevel);
    expect(result.success).toBe(true);
  });

  it('parses inventory_item_id, variant_id, location_id (all distinct integers)', () => {
    const result = InventoryLevelSchema.parse(validLevel);
    expect(Number.isInteger(result.inventory_item_id)).toBe(true);
    expect(Number.isInteger(result.variant_id)).toBe(true);
    expect(Number.isInteger(result.location_id)).toBe(true);
    // Sapo: inventory_item_id !== variant_id (NOT 1:1 as initially assumed)
    expect(result.inventory_item_id).not.toBe(result.variant_id);
  });

  it('accepts FLOAT quantities (Sapo quirk — not integer)', () => {
    const floatLevel = { ...validLevel, available: 12.5, on_hand: 100.75 };
    const result = InventoryLevelSchema.safeParse(floatLevel);
    expect(result.success).toBe(true);
  });

  it('uses created_at/updated_at — Shopify-style exception', () => {
    const result = InventoryLevelSchema.parse(validLevel);
    expect(result.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('passes through unknown fields (forward compat)', () => {
    const withExtra = { ...validLevel, future_field: 'xyz' };
    const result = InventoryLevelSchema.parse(withExtra);
    expect((result as Record<string, unknown>).future_field).toBe('xyz');
  });

  it('requires id, variant_id, inventory_item_id, location_id, on_hand, available', () => {
    const missing = { id: 1, variant_id: 2 };
    const result = InventoryLevelSchema.safeParse(missing);
    expect(result.success).toBe(false);
  });
});

describe('InventoryLevelListResponseSchema', () => {
  it('parses captured 3-record list response', () => {
    const result = InventoryLevelListResponseSchema.safeParse(listFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inventory_levels).toHaveLength(3);
    }
  });
});
