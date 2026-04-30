/**
 * LocationSchema — Sapo Location resource.
 *
 * Endpoint: /admin/locations.json
 * Status: UNDOCUMENTED in Sapo official docs. Verified working 2026-04-30.
 *
 * Sapo convention: created_on / modified_on timestamps.
 * Uses .passthrough() — only fields used by tools are validated.
 */

import { z } from 'zod';

export const LocationSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    address1: z.string().nullable().optional(),
    address2: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    province: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    zip: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    active: z.boolean().optional(),
    created_on: z.string().optional(),
    modified_on: z.string().optional(),
  })
  .passthrough();

export type Location = z.infer<typeof LocationSchema>;

export const LocationSingleResponseSchema = z.object({ location: LocationSchema }).passthrough();

export type LocationSingleResponse = z.infer<typeof LocationSingleResponseSchema>;

export const LocationListResponseSchema = z
  .object({ locations: z.array(LocationSchema) })
  .passthrough();

export type LocationListResponse = z.infer<typeof LocationListResponseSchema>;
