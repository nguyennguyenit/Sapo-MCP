/**
 * CustomerSchema — Sapo Customer resource.
 *
 * Key deviations from Shopify:
 * - Timestamps: created_on / modified_on (not created_at / updated_at)
 * - No tax_exempt field (Sapo does not expose this)
 * - gender field: Male | Female | Other (Sapo-specific)
 * - dob: birth date YYYY-MM-DD (Sapo-specific)
 * - state enum: enabled | disabled | invited | decline
 * - total_spent: integer VND (not decimal)
 * - addresses nested; see AddressSchema
 */

import { z } from 'zod';
import { AddressSchema } from './address.js';

export const CustomerStateEnum = z.enum(['enabled', 'disabled', 'invited', 'decline']);
export const CustomerGenderEnum = z.enum(['Male', 'Female', 'Other']);

export const CustomerSchema = z
  .object({
    id: z.number().int(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    state: CustomerStateEnum.optional(),
    accepts_marketing: z.boolean().optional(),
    verified_email: z.boolean().optional(),
    gender: CustomerGenderEnum.optional().nullable(),
    /** Birth date in YYYY-MM-DD format */
    dob: z.string().optional().nullable(),
    orders_count: z.number().int().optional(),
    /** Total amount spent in integer VND */
    total_spent: z.number().int().optional(),
    tags: z.string().optional().nullable(),
    note: z.string().optional().nullable(),
    last_order_id: z.number().int().optional().nullable(),
    last_order_name: z.string().optional().nullable(),
    default_address: AddressSchema.optional().nullable(),
    addresses: z.array(AddressSchema).optional(),
    created_on: z.string(),
    modified_on: z.string(),
  })
  .passthrough();

export type Customer = z.infer<typeof CustomerSchema>;

export const CustomerSingleResponseSchema = z.object({ customer: CustomerSchema }).passthrough();

export type CustomerSingleResponse = z.infer<typeof CustomerSingleResponseSchema>;

export const CustomerListResponseSchema = z
  .object({ customers: z.array(CustomerSchema) })
  .passthrough();

export type CustomerListResponse = z.infer<typeof CustomerListResponseSchema>;
