/**
 * PaymentMethodSchema — Sapo Payment Method resource.
 *
 * Endpoint: /admin/payment_methods.json
 * Status: UNDOCUMENTED in Sapo official docs. Verified working 2026-04-30.
 *
 * Uses .passthrough() — schema may drift without notice.
 */

import { z } from 'zod';

export const PaymentMethodSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    code: z.string().optional(),
    active: z.boolean().optional(),
    created_on: z.string().optional(),
    modified_on: z.string().optional(),
  })
  .passthrough();

export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PaymentMethodListResponseSchema = z
  .object({ payment_methods: z.array(PaymentMethodSchema) })
  .passthrough();

export type PaymentMethodListResponse = z.infer<typeof PaymentMethodListResponseSchema>;
