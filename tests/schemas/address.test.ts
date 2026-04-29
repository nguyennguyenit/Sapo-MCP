/**
 * Tests for AddressSchema — Vietnamese address schema
 */
import { describe, expect, it } from 'vitest';
import { AddressListResponseSchema, AddressSchema } from '../../src/schemas/address.js';
import addressList from '../fixtures/sapo/customers/addresses-list.json' with { type: 'json' };

const validAddress = addressList.addresses[0];

describe('AddressSchema', () => {
  it('parses a valid Vietnamese address', () => {
    const result = AddressSchema.safeParse(validAddress);
    expect(result.success).toBe(true);
  });

  it('includes province full name (not abbreviation)', () => {
    const result = AddressSchema.parse(validAddress);
    expect(result.province).toBe('Hà Nội');
  });

  it('includes district and ward fields', () => {
    const result = AddressSchema.parse(validAddress);
    expect(result.district).toBe('Hoàn Kiếm');
    expect(result.ward).toBe('Lý Thái Tổ');
  });

  it('passes through unknown fields (additive drift tolerance)', () => {
    const withExtra = { ...validAddress, lat: 21.0245, lng: 105.8412 };
    const result = AddressSchema.parse(withExtra);
    // passthrough: extra fields preserved
    expect((result as Record<string, unknown>).lat).toBe(21.0245);
  });

  it('requires id, address1, city, province, country', () => {
    const missing = { id: 1, address1: '123 Test', city: 'Hà Nội' };
    const result = AddressSchema.safeParse(missing);
    expect(result.success).toBe(false);
  });

  it('allows null address2 and ward', () => {
    const addr = addressList.addresses[1];
    const result = AddressSchema.safeParse(addr);
    expect(result.success).toBe(true);
  });

  it('does NOT have a state abbreviation field', () => {
    const result = AddressSchema.parse(validAddress);
    // Sapo uses province (full name), not US-style state abbreviation
    expect(Object.keys(result)).not.toContain('state');
  });
});

describe('AddressListResponseSchema', () => {
  it('parses addresses list fixture', () => {
    const result = AddressListResponseSchema.safeParse(addressList);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.addresses).toHaveLength(2);
    }
  });
});
