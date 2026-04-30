/**
 * Customer Address tools for pos-online mode.
 * Registers: list_customer_addresses, add_customer_address,
 *            update_customer_address, set_default_customer_address
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import { AddressListResponseSchema, AddressSingleResponseSchema } from '../schemas/address.js';
import { resolveProvince } from './address-resolver.js';
import { detectLevel2WriteAttempt } from './address-write-validation.js';
import { errResponse, handleNotFound, okResponse } from './tool-response.js';

const addressWriteFields = {
  address1: z.string().optional().describe('Primary address line.'),
  address2: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional().describe('Country name (e.g. "Vietnam").'),
  country_code: z.string().optional(),
  province: z.string().optional().describe('Vietnamese province name (e.g. "Hà Nội").'),
  province_code: z.string().optional(),
  district: z.string().optional(),
  district_code: z.string().optional(),
  ward: z.string().optional(),
  ward_code: z.string().optional(),
  zip: z.string().optional(),
  phone: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company: z.string().optional(),
};

export function registerCustomerAddressTools(server: McpServer, client: SapoClient): void {
  // ── list_customer_addresses ─────────────────────────────────────────────────
  server.registerTool(
    'list_customer_addresses',
    {
      description:
        'List all saved addresses for a customer, including default address flag and Vietnamese province/district/ward fields.',
      inputSchema: {
        customer_id: z.number().int().describe('Customer ID whose addresses to list. Required.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(250)
          .optional()
          .describe('Max results per page (default 50, max 250).'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const params: Record<string, string | number | boolean | undefined> = {};
        if (args.limit !== undefined) params.limit = args.limit;

        const raw = await client.get(`/customers/${args.customer_id}/addresses.json`, { params });
        const parsed = AddressListResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: addresses');
        return okResponse(parsed.data.addresses);
      }, 'Customer');
    },
  );

  // ── add_customer_address ────────────────────────────────────────────────────
  server.registerTool(
    'add_customer_address',
    {
      description:
        'Add a new address to a customer. Required: address1, city, country. ' +
        'Province handling: pass either `province` (text — fuzzy-matched, e.g. "Hồ Chí Minh", ' +
        '"HCM", "TPHCM" all resolve to canonical "TP Hồ Chí Minh") OR `province_code` (1–63). ' +
        'The tool fills the missing field from the canonical Sapo dataset. ' +
        'For district/ward: pass BOTH text name AND code together (use list_districts / list_wards). ' +
        'NOTE: Sapo write API only accepts the pre-2025 3-tier schema. Post-2025 codes ' +
        '(province_code 2001+, district_code "-1") are rejected pre-flight.',
      inputSchema: {
        customer_id: z.number().int().describe('Customer ID to add address to. Required.'),
        ...addressWriteFields,
        address1: z.string().describe('Primary address line. Required.'),
        city: z.string().describe('City name. Required.'),
        country: z.string().describe('Country name (e.g. "Vietnam"). Required.'),
      },
    },
    async (args) => {
      const level2Err = detectLevel2WriteAttempt(args);
      if (level2Err) return errResponse(level2Err);
      const resolved = await resolveProvince(args, client);
      if (typeof resolved === 'string') return errResponse(resolved);
      return handleNotFound(async () => {
        const { customer_id, ...rest } = args;
        const body: Record<string, unknown> = { ...rest };
        for (const k of Object.keys(body)) {
          if (body[k] === undefined) delete body[k];
        }
        if (resolved) {
          body.province = resolved.province;
          body.province_code = resolved.province_code;
        }
        const raw = await client.post(`/customers/${customer_id}/addresses.json`, {
          address: body,
        });
        const parsed = AddressSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: add address');
        return okResponse(parsed.data.address);
      }, 'Customer');
    },
  );

  // ── update_customer_address ─────────────────────────────────────────────────
  server.registerTool(
    'update_customer_address',
    {
      description:
        'Update an existing customer address. Only provided fields are modified. ' +
        'To set this address as default, use set_default_customer_address (Sapo dedicated endpoint). ' +
        'IMPORTANT: When changing subdivision fields, pass BOTH the text name AND the code ' +
        '(e.g. province + province_code together) — codes alone are silently dropped. ' +
        'Sapo write API only accepts the pre-2025 3-tier schema; new 2-tier addresses cannot be ' +
        'written via this endpoint (returns 422 "Ward is not supported").',
      inputSchema: {
        customer_id: z.number().int().describe('Customer ID. Required.'),
        address_id: z.number().int().describe('Address ID to update. Required.'),
        ...addressWriteFields,
      },
    },
    async (args) => {
      const level2Err = detectLevel2WriteAttempt(args);
      if (level2Err) return errResponse(level2Err);
      const resolved = await resolveProvince(args, client);
      if (typeof resolved === 'string') return errResponse(resolved);
      return handleNotFound(async () => {
        const { customer_id, address_id, ...rest } = args;
        const body: Record<string, unknown> = { ...rest };
        for (const k of Object.keys(body)) {
          if (body[k] === undefined) delete body[k];
        }
        if (resolved) {
          body.province = resolved.province;
          body.province_code = resolved.province_code;
        }
        const raw = await client.put(
          `/customers/${customer_id}/addresses/${address_id}.json`,
          { address: body },
        );
        const parsed = AddressSingleResponseSchema.safeParse(raw);
        if (!parsed.success) return errResponse('Invalid response from Sapo API: update address');
        return okResponse(parsed.data.address);
      }, 'Customer');
    },
  );

  // ── set_default_customer_address ────────────────────────────────────────────
  server.registerTool(
    'set_default_customer_address',
    {
      description:
        "Set a customer's default address via Sapo's dedicated endpoint " +
        '(PUT /customers/{id}/addresses/{addr_id}/default.json). Returns the address now marked default.',
      inputSchema: {
        customer_id: z.number().int().describe('Customer ID. Required.'),
        address_id: z.number().int().describe('Address ID to mark as default. Required.'),
      },
    },
    async (args) => {
      return handleNotFound(async () => {
        const raw = await client.put(
          `/customers/${args.customer_id}/addresses/${args.address_id}/default.json`,
          {},
        );
        const parsed = AddressSingleResponseSchema.safeParse(raw);
        if (!parsed.success)
          return errResponse('Invalid response from Sapo API: set default address');
        return okResponse(parsed.data.address);
      }, 'Customer');
    },
  );
}
