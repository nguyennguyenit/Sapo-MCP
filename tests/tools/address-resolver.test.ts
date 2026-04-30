/**
 * Tests for resolveProvince — fuzzy matching of province text/code to canonical pair.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SapoClient } from '../../src/client/http.js';
import { _resetProvinceCache, resolveProvince } from '../../src/tools/address-resolver.js';

const PROVINCES_FIXTURE = {
  provinces: [
    { id: 1, name: 'Hà Nội', code: '1', country_id: 201 },
    { id: 2, name: 'TP Hồ Chí Minh', code: '2', country_id: 201 },
    { id: 31, name: 'Đà Nẵng', code: '31', country_id: 201 },
    { id: 48, name: 'Cần Thơ', code: '48', country_id: 201 },
    { id: 4, name: 'Bà Rịa-Vũng Tàu', code: '4', country_id: 201 },
  ],
};

function makeClient(): SapoClient {
  return {
    get: vi.fn().mockResolvedValue(PROVINCES_FIXTURE),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
    buildUrl: vi.fn(),
  } as unknown as SapoClient;
}

describe('resolveProvince', () => {
  beforeEach(() => {
    _resetProvinceCache();
  });

  it('returns null when both province and province_code absent', async () => {
    const client = makeClient();
    expect(await resolveProvince({}, client)).toBeNull();
    expect(client.get).not.toHaveBeenCalled();
  });

  it('resolves canonical exact match', async () => {
    const r = await resolveProvince({ province: 'TP Hồ Chí Minh' }, makeClient());
    expect(r).toEqual({ province: 'TP Hồ Chí Minh', province_code: '2' });
  });

  it('resolves "Hồ Chí Minh" (missing TP prefix) via normalization', async () => {
    const r = await resolveProvince({ province: 'Hồ Chí Minh' }, makeClient());
    expect(r).toEqual({ province: 'TP Hồ Chí Minh', province_code: '2' });
  });

  it('resolves "TP. Hồ Chí Minh" (extra period)', async () => {
    const r = await resolveProvince({ province: 'TP. Hồ Chí Minh' }, makeClient());
    expect(r).toEqual({ province: 'TP Hồ Chí Minh', province_code: '2' });
  });

  it('resolves "Thành phố Hồ Chí Minh" (full prefix)', async () => {
    const r = await resolveProvince({ province: 'Thành phố Hồ Chí Minh' }, makeClient());
    expect(r).toEqual({ province: 'TP Hồ Chí Minh', province_code: '2' });
  });

  it('resolves manual aliases HCM/TPHCM/HN/DN/HP/CT', async () => {
    const c = makeClient();
    expect(await resolveProvince({ province: 'HCM' }, c)).toEqual({
      province: 'TP Hồ Chí Minh',
      province_code: '2',
    });
    expect(await resolveProvince({ province: 'TPHCM' }, c)).toEqual({
      province: 'TP Hồ Chí Minh',
      province_code: '2',
    });
    expect(await resolveProvince({ province: 'HN' }, c)).toEqual({
      province: 'Hà Nội',
      province_code: '1',
    });
    expect(await resolveProvince({ province: 'DN' }, c)).toEqual({
      province: 'Đà Nẵng',
      province_code: '31',
    });
  });

  it('resolves ASCII-stripped input "ha noi"', async () => {
    const r = await resolveProvince({ province: 'ha noi' }, makeClient());
    expect(r).toEqual({ province: 'Hà Nội', province_code: '1' });
  });

  it('resolves by province_code only and fills canonical text', async () => {
    const r = await resolveProvince({ province_code: '2' }, makeClient());
    expect(r).toEqual({ province: 'TP Hồ Chí Minh', province_code: '2' });
  });

  it('province_code wins when both provided (even if text mismatches)', async () => {
    const r = await resolveProvince(
      { province: 'Wrong Province', province_code: '1' },
      makeClient(),
    );
    expect(r).toEqual({ province: 'Hà Nội', province_code: '1' });
  });

  it('returns error for unknown province_code', async () => {
    const r = await resolveProvince({ province_code: '999' }, makeClient());
    expect(typeof r).toBe('string');
    expect(r).toContain('not in the level=3 dataset');
  });

  it('returns error for unrecognized province name', async () => {
    const r = await resolveProvince({ province: 'Atlantis' }, makeClient());
    expect(typeof r).toBe('string');
    expect(r).toContain('not recognized');
  });

  it('caches province list across calls (single fetch)', async () => {
    const c = makeClient();
    await resolveProvince({ province: 'HN' }, c);
    await resolveProvince({ province: 'HCM' }, c);
    await resolveProvince({ province_code: '4' }, c);
    expect(c.get).toHaveBeenCalledTimes(1);
  });
});
