/**
 * AddressSchema — Vietnamese address shared by Customer addresses,
 * Order shipping_address, billing_address, etc.
 *
 * Sapo address fields use Vietnamese subdivisions:
 *   province (full name e.g. "Hà Nội"), district, ward
 * No state abbreviation (Shopify pattern). No lat/lng in address resource per API spec.
 */

import { z } from 'zod';

export const AddressSchema = z
  .object({
    id: z.number().int(),
    customer_id: z.number().int().optional(),
    first_name: z.string().optional().nullable(),
    last_name: z.string().optional().nullable(),
    address1: z.string(),
    address2: z.string().optional().nullable(),
    city: z.string(),
    /** Full Vietnamese province name e.g. "Hà Nội", "Hồ Chí Minh" */
    province: z.string(),
    /** Short province code e.g. "HN", "HCM" */
    province_code: z.string().optional().nullable(),
    /** Vietnamese district name e.g. "Hoàn Kiếm", "Quận 1" */
    district: z.string().optional().nullable(),
    /** Vietnamese ward name e.g. "Lý Thái Tổ", "Bến Nghé" */
    ward: z.string().optional().nullable(),
    country: z.string(),
    /** ISO 3166-1 alpha-3 code e.g. "VNM" */
    country_code: z.string().optional().nullable(),
    zip: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    company: z.string().optional().nullable(),
    /** True if this is the customer's default address */
    default: z.boolean().optional(),
    created_on: z.string().optional(),
    modified_on: z.string().optional(),
  })
  .passthrough();

export type Address = z.infer<typeof AddressSchema>;

export const AddressListResponseSchema = z
  .object({ addresses: z.array(AddressSchema) })
  .passthrough();

export type AddressListResponse = z.infer<typeof AddressListResponseSchema>;
