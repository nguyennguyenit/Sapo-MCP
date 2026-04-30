/**
 * Tests for detectLevel2WriteAttempt — pre-flight rejection of post-2025 codes.
 */
import { describe, expect, it } from 'vitest';
import { detectLevel2WriteAttempt } from '../../src/tools/address-write-validation.js';

describe('detectLevel2WriteAttempt', () => {
  it('returns null for empty payload', () => {
    expect(detectLevel2WriteAttempt({})).toBeNull();
  });

  it('returns null for valid level=3 codes', () => {
    expect(
      detectLevel2WriteAttempt({
        province_code: '2',
        district_code: '10924',
        ward_code: '107436',
      }),
    ).toBeNull();
  });

  it('returns null for boundary level=3 province_code "63"', () => {
    expect(detectLevel2WriteAttempt({ province_code: '63' })).toBeNull();
  });

  it('rejects level=2 province_code (≥ 2001)', () => {
    const err = detectLevel2WriteAttempt({ province_code: '2001' });
    expect(err).toContain('province_code');
    expect(err).toContain('2001');
  });

  it('rejects level=2 ward_code (≥ 200000)', () => {
    const err = detectLevel2WriteAttempt({ ward_code: '200001' });
    expect(err).toContain('ward_code');
    expect(err).toContain('Ward is not supported');
  });

  it('rejects district_code "-1" sentinel', () => {
    const err = detectLevel2WriteAttempt({ district_code: '-1' });
    expect(err).toContain('district_code "-1"');
    expect(err).toContain('level=2');
  });

  it('district_code "-1" takes precedence (highest signal of level=2)', () => {
    const err = detectLevel2WriteAttempt({
      province_code: '2001',
      district_code: '-1',
      ward_code: '200001',
    });
    expect(err).toContain('district_code "-1"');
  });

  it('does not reject non-numeric codes (defensive)', () => {
    expect(detectLevel2WriteAttempt({ province_code: 'abc' })).toBeNull();
    expect(detectLevel2WriteAttempt({ ward_code: '' })).toBeNull();
  });
});
