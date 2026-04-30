/**
 * SupplierSchema — Sapo Supplier resource.
 *
 * Endpoint: /admin/suppliers.json
 * Status: UNDOCUMENTED in Sapo official docs. Verified working 2026-04-30.
 *
 * Stub fixture — replace with real capture from `npm run capture:fixtures` before 0.2.0 publish.
 * Uses .passthrough() — only id/name/timestamps validated.
 */

import { z } from 'zod';

export const SupplierSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    phone: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    created_on: z.string().optional(),
    modified_on: z.string().optional(),
  })
  .passthrough();

export type Supplier = z.infer<typeof SupplierSchema>;

export const SupplierSingleResponseSchema = z.object({ supplier: SupplierSchema }).passthrough();

export type SupplierSingleResponse = z.infer<typeof SupplierSingleResponseSchema>;

export const SupplierListResponseSchema = z
  .object({ suppliers: z.array(SupplierSchema) })
  .passthrough();

export type SupplierListResponse = z.infer<typeof SupplierListResponseSchema>;
