/**
 * InventoryLevelSchema — Sapo Inventory Level resource (read-only).
 *
 * Schema captured from live API on store giapducthangscs (2026-04-30).
 * Endpoint is UNDOCUMENTED in Sapo official docs — schema may drift.
 *
 * Important Sapo-specific quirks (live-verified, NOT assumptions):
 * - Timestamps use `created_at`/`updated_at` (Shopify-style, NOT Sapo's
 *   usual `created_on`/`modified_on` convention — this resource is the exception)
 * - Quantities are FLOAT (e.g. 100.000), NOT integer
 * - inventory_item_id and variant_id are DIFFERENT (not 1:1)
 * - store_id present (multi-store identifier)
 *
 * Reference: tests/fixtures/sapo/inventory-levels/list.json (captured 2026-04-30)
 */

import { z } from 'zod';

export const InventoryLevelSchema = z
  .object({
    id: z.number().int(),
    variant_id: z.number().int(),
    store_id: z.number().int().optional(),
    inventory_item_id: z.number().int(),
    location_id: z.number().int(),
    /** Total physical inventory at location */
    on_hand: z.number(),
    /** Quantity available for sale (on_hand - committed - reserved) */
    available: z.number(),
    /** Committed to unfulfilled orders */
    committed: z.number().optional(),
    /** Incoming from purchase orders / transfers */
    incoming: z.number().optional(),
    incoming_owned: z.number().optional(),
    incoming_not_owned: z.number().optional(),
    /** Packed but not yet shipped */
    packed: z.number().optional(),
    /** Reserved for draft orders / holds */
    reserved: z.number().optional(),
    /** Damaged / quarantined */
    unavailable: z.number().optional(),
    /** Sapo exception: this resource uses _at not _on */
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export type InventoryLevel = z.infer<typeof InventoryLevelSchema>;

export const InventoryLevelListResponseSchema = z
  .object({ inventory_levels: z.array(InventoryLevelSchema) })
  .passthrough();

export type InventoryLevelListResponse = z.infer<typeof InventoryLevelListResponseSchema>;
