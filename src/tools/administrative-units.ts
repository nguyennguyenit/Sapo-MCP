/**
 * Vietnamese administrative unit tools (provinces / districts / wards).
 * Registers: list_provinces, list_districts, list_wards.
 *
 * Vietnam reform 2025-07-01: 63→34 tỉnh, abolished district level.
 * Sapo exposes BOTH schemas via `?level=` param (level = number of admin tiers):
 *   - level=3 (default): 63 tỉnh, 3-cấp (Tỉnh → Quận/Huyện → Phường/Xã) — pre-reform
 *   - level=2:           34 tỉnh, 2-cấp (Tỉnh → Phường/Xã) — post-reform; districts.json returns []
 *   - level=1:           empty (reserved)
 *
 * Discriminator on Address resource:
 *   province_code "1"–"63"  → 3-tier (level=3) schema
 *   province_code >= "2001" → 2-tier (level=2) schema
 *   district_code "-1"      → 2-tier sentinel
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import { errResponse, okResponse } from './tool-response.js';

const ProvinceSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    code: z.string(),
    country_id: z.number().int().optional().nullable(),
  })
  .passthrough();

const DistrictSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    code: z.string(),
    province_id: z.number().int().optional().nullable(),
  })
  .passthrough();

const WardSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    code: z.string(),
    province_id: z.number().int().optional().nullable(),
    /** "-1" (sentinel) when level=2 — no district concept post-reform */
    district_id: z.number().int().optional().nullable(),
    district_code: z.string().optional().nullable(),
  })
  .passthrough();

const ProvinceListSchema = z.object({ provinces: z.array(ProvinceSchema) }).passthrough();
const DistrictListSchema = z.object({ districts: z.array(DistrictSchema) }).passthrough();
const WardListSchema = z.object({ wards: z.array(WardSchema) }).passthrough();

const levelField = z
  .union([z.literal(2), z.literal(3)])
  .optional()
  .describe(
    'Number of administrative tiers. 3 = pre-reform 63 tỉnh, Tỉnh→Quận→Phường (default when omitted). ' +
      '2 = post-2025-07-01 34 tỉnh, Tỉnh→Phường (no district). For new addresses use level=2.',
  );

export function registerAdministrativeUnitTools(server: McpServer, client: SapoClient): void {
  server.registerTool(
    'list_provinces',
    {
      description:
        'List Vietnamese provinces. Default (omit level) = level=3 = pre-2025 63 tỉnh, 3-tier. ' +
        'Use level=2 for post-2025 34 tỉnh, 2-tier (after merger). Province codes differ between ' +
        'schemas: level=3 codes are "1"–"63"; level=2 codes start at "2001". ' +
        'WORKFLOW: For new schema → list_provinces({level:2}) then list_wards({level:2, province_code}). ' +
        'For old schema → list_provinces() → list_districts({province_code}) → list_wards({district_code}). ' +
        'NOTE: Sapo write endpoints (add/update_customer_address) currently accept ONLY level=3 codes; ' +
        'level=2 is read-only as of 2026-05.',
      inputSchema: { level: levelField },
    },
    async (args) => {
      const params: Record<string, string | number | boolean | undefined> = {};
      if (args.level !== undefined) params.level = args.level;
      const raw = await client.get('/provinces.json', { params });
      const parsed = ProvinceListSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: provinces');
      return okResponse(parsed.data.provinces);
    },
  );

  server.registerTool(
    'list_districts',
    {
      description:
        'List districts (Quận/Huyện) within a province. Only meaningful for level=3 ' +
        '(pre-2025 3-tier schema, default). With level=2 the response is empty because the ' +
        'district level was abolished on 2025-07-01.',
      inputSchema: {
        province_code: z.string().describe('Province code from list_provinces. Required.'),
        level: levelField,
      },
    },
    async (args) => {
      const params: Record<string, string | number | boolean | undefined> = {
        province_code: args.province_code,
      };
      if (args.level !== undefined) params.level = args.level;
      const raw = await client.get('/districts.json', { params });
      const parsed = DistrictListSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: districts');
      return okResponse(parsed.data.districts);
    },
  );

  server.registerTool(
    'list_wards',
    {
      description:
        'List wards (Phường/Xã). For level=3 (default, 3-tier) pass district_code obtained from ' +
        'list_districts. For level=2 (2-tier post-reform) pass province_code obtained from ' +
        'list_provinces({level:2}). Post-reform wards attach directly to province — their ' +
        'district_code is the sentinel "-1".',
      inputSchema: {
        province_code: z.string().optional().describe('Province code. Required when level=2.'),
        district_code: z
          .string()
          .optional()
          .describe(
            'District code from list_districts. Required for level=3 (3-tier schema, default).',
          ),
        level: levelField,
      },
    },
    async (args) => {
      const params: Record<string, string | number | boolean | undefined> = {};
      if (args.province_code !== undefined) params.province_code = args.province_code;
      if (args.district_code !== undefined) params.district_code = args.district_code;
      if (args.level !== undefined) params.level = args.level;
      const raw = await client.get('/wards.json', { params });
      const parsed = WardListSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: wards');
      return okResponse(parsed.data.wards);
    },
  );
}
