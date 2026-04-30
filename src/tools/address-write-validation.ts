/**
 * Pre-flight validation for address write payloads.
 *
 * Sapo write API only accepts the pre-2025 3-tier (level=3) schema. Probes 2026-05-01:
 *   - province_code "2001"+ → silent rewrite or 422
 *   - district_code "-1" → 422 "District is not supported"
 *   - ward_code "200000"+ → 422 "Ward is not supported"
 *
 * This module rejects writes with level=2 codes BEFORE hitting Sapo to:
 *   1. Prevent silent corruption (Sapo returns 200 with null subdivision fields)
 *   2. Save round-trips
 *   3. Educate the LLM caller via clear error messages
 *
 * Block ONLY values that are 100% guaranteed to fail. When Sapo opens write for level=2,
 * canary tests will alert and this whole module can be deleted.
 */

export interface AddressWriteFields {
  province_code?: string;
  district_code?: string;
  ward_code?: string;
}

/** Returns an error message string when payload is rejected, or null when OK. */
export function detectLevel2WriteAttempt(addr: AddressWriteFields): string | null {
  if (addr.district_code === '-1') {
    return (
      'district_code "-1" is the level=2 (post-2025-07-01) sentinel. ' +
      'Sapo write API only accepts level=3 codes. Use list_districts() to obtain a real district_code.'
    );
  }

  if (addr.ward_code != null) {
    const n = Number.parseInt(addr.ward_code, 10);
    if (Number.isFinite(n) && n >= 200000) {
      return (
        `ward_code "${addr.ward_code}" is from the level=2 dataset (post-2025-07-01 wards have codes ≥ 200000). ` +
        'Sapo write API rejects these with 422 "Ward is not supported". ' +
        'Use list_wards({district_code}) without a level param to obtain a level=3 ward_code.'
      );
    }
  }

  if (addr.province_code != null) {
    const n = Number.parseInt(addr.province_code, 10);
    if (Number.isFinite(n) && n >= 2001) {
      return (
        `province_code "${addr.province_code}" is from the level=2 dataset (post-2025-07-01 provinces have codes ≥ 2001). ` +
        'Sapo write API silently drops it. Use list_provinces() (default level=3) to obtain a code in "1"–"63".'
      );
    }
  }

  return null;
}
