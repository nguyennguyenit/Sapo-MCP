/**
 * Address resolver — normalize province text/code into Sapo canonical {province, province_code}.
 *
 * Sapo write API requires BOTH text name AND code together. Common user inputs:
 *   - "Hồ Chí Minh"  → canonical "TP Hồ Chí Minh" + code "2"
 *   - "TP. Hồ Chí Minh" → canonical "TP Hồ Chí Minh" + code "2"
 *   - "HCM" / "TPHCM" → manual aliases
 *   - province_code "2" only → fill text from list
 *
 * Strategy:
 *   1. Lazy-fetch /admin/provinces.json on first call, cache in module scope.
 *   2. Build lookup maps: by code, by normalized name.
 *   3. Normalization: lowercase + strip diacritics + remove "TP", "Tỉnh", "Thành phố", periods, extra spaces.
 *   4. Manual alias table for common shorthands (HCM, HN, etc.).
 *
 * District/ward resolution NOT implemented here — they vary per province and have
 * less alias confusion. Users typically copy from list_districts/list_wards directly.
 * Pair validation still applies via detectLevel2WriteAttempt + this resolver.
 */

import type { SapoClient } from '../client/http.js';

interface ProvinceEntry {
  name: string;
  code: string;
}

interface ProvinceCache {
  byCode: Map<string, ProvinceEntry>;
  byName: Map<string, ProvinceEntry>;
}
let cache: ProvinceCache | null = null;
let inflight: Promise<ProvinceCache> | null = null;

/** Strip diacritics, lowercase, remove common prefixes/punctuation. */
function normalizeProvinceName(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\b(tp|t\.p|tinh|thanh pho)\b\.?/g, '')
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Manual aliases — short codes users commonly type. */
const MANUAL_ALIASES: Record<string, string> = {
  hcm: 'TP Hồ Chí Minh',
  tphcm: 'TP Hồ Chí Minh',
  saigon: 'TP Hồ Chí Minh',
  'sai gon': 'TP Hồ Chí Minh',
  hn: 'Hà Nội',
  dn: 'Đà Nẵng',
  hp: 'Hải Phòng',
  ct: 'Cần Thơ',
};

async function loadProvinces(client: SapoClient): Promise<ProvinceCache> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const raw = (await client.get('/provinces.json')) as { provinces?: ProvinceEntry[] };
    const list = raw.provinces ?? [];
    const byCode = new Map<string, ProvinceEntry>();
    const byName = new Map<string, ProvinceEntry>();
    for (const p of list) {
      byCode.set(p.code, p);
      byName.set(normalizeProvinceName(p.name), p);
    }
    // Inject manual aliases pointing to canonical entries already in byName
    for (const [alias, canonical] of Object.entries(MANUAL_ALIASES)) {
      const entry = byName.get(normalizeProvinceName(canonical));
      if (entry) byName.set(alias, entry);
    }
    cache = { byCode, byName };
    return cache;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** Reset cache — for tests only. */
export function _resetProvinceCache(): void {
  cache = null;
  inflight = null;
}

export interface ResolveProvinceInput {
  province?: string;
  province_code?: string;
}

export interface ResolveProvinceResult {
  /** Canonical name matching Sapo write API exactly. */
  province: string;
  /** Canonical level=3 code "1"–"63". */
  province_code: string;
}

/**
 * Resolve {province, province_code} pair from partial input.
 * Returns the canonical pair, OR an error string if input is unresolvable.
 * Returns null when both fields are absent (caller may skip subdivision entirely).
 */
export async function resolveProvince(
  input: ResolveProvinceInput,
  client: SapoClient,
): Promise<ResolveProvinceResult | string | null> {
  if (!input.province && !input.province_code) return null;

  const c = await loadProvinces(client);

  // Code is more specific — try first.
  if (input.province_code) {
    const byCode = c.byCode.get(input.province_code);
    if (!byCode) {
      return (
        `province_code "${input.province_code}" is not in the level=3 dataset (1–63). ` +
        'Use list_provinces() to see valid codes.'
      );
    }
    return { province: byCode.name, province_code: byCode.code };
  }

  // Resolve by text via normalization + alias table.
  const normalized = normalizeProvinceName(input.province!);
  const byName = c.byName.get(normalized);
  if (byName) return { province: byName.name, province_code: byName.code };

  return (
    `province "${input.province}" not recognized. ` +
    'Use list_provinces() to see canonical names (e.g. "TP Hồ Chí Minh" not "Hồ Chí Minh"). ' +
    'Common aliases supported: HCM, TPHCM, HN, DN, HP, CT.'
  );
}
