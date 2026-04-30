/**
 * Tests for registerCustomerTools — list_customers, get_customer,
 * search_customers, count_customers, list_customer_orders
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import { _resetProvinceCache } from '../../src/tools/address-resolver.js';
import { registerCustomerTools } from '../../src/tools/customers.js';
import listFixture from '../fixtures/sapo/customers/list-response.json' with { type: 'json' };
import listNullProvinceFixture from '../fixtures/sapo/customers/list-with-null-province.json' with { type: 'json' };
import singleFixture from '../fixtures/sapo/customers/single.json' with { type: 'json' };

function makeServer(): McpServer {
  return new McpServer({ name: 'test', version: '0.0.0' });
}

function makeClient(): SapoClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
    buildUrl: vi.fn(),
  } as unknown as SapoClient;
}

/** Call a registered tool handler by name */
async function callTool(server: McpServer, name: string, args: Record<string, unknown>) {
  const tools = (
    server as unknown as {
      _registeredTools: Record<string, { handler: (args: unknown) => Promise<unknown> }>;
    }
  )._registeredTools;
  const tool = tools[name];
  if (!tool) throw new Error(`Tool not registered: ${name}`);
  return tool.handler(args);
}

describe('registerCustomerTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    _resetProvinceCache();
    server = makeServer();
    client = makeClient();
    registerCustomerTools(server, client);
  });

  describe('list_customers', () => {
    it('calls /customers.json and returns paginated envelope', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_customers', { limit: 2 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith(
        '/customers.json',
        expect.objectContaining({ params: expect.objectContaining({ limit: 2 }) }),
      );
      expect(text.data).toHaveLength(2);
      expect(text.has_more).toBe(true); // 2 items == limit 2
    });

    it('returns has_more=false when items < limit', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_customers', { limit: 50 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.has_more).toBe(false);
      expect(text.next_since_id).toBeNull();
    });

    it('returns next_since_id when has_more=true', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_customers', { limit: 2 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.next_since_id).toBe(1002);
    });

    it('passes since_id param when provided', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ customers: [] });

      await callTool(server, 'list_customers', { since_id: 1000 });
      expect(client.get).toHaveBeenCalledWith(
        '/customers.json',
        expect.objectContaining({ params: expect.objectContaining({ since_id: 1000 }) }),
      );
    });

    // Regression: real Sapo responses include addresses with province/district/ward = null
    // when those fields were not supplied at create time. AddressSchema must tolerate this
    // or the entire list parse fails — see memory "Sapo API quirks" #4.6 (capture-and-pin).
    it('parses customer list when addresses have null subdivision fields', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listNullProvinceFixture);

      const result = await callTool(server, 'list_customers', { limit: 50 });
      const wrapped = result as { content: Array<{ text: string }>; isError?: boolean };
      expect(wrapped.isError).not.toBe(true);
      const text = JSON.parse(wrapped.content[0].text);
      expect(text.data).toHaveLength(1);
      expect(text.data[0].id).toBe(42240755);
      expect(text.data[0].addresses[0].province).toBeNull();
    });
  });

  describe('get_customer', () => {
    it('calls /customers/{id}.json and returns customer data', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(singleFixture);

      const result = await callTool(server, 'get_customer', { customer_id: 1001 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/customers/1001.json');
      expect(text.id).toBe(1001);
      expect(text.email).toBe('nguyen.van.a@example.com');
    });

    it('returns isError:true on SapoNotFoundError', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('Customer'));

      const result = await callTool(server, 'get_customer', { customer_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
      expect((result as { content: Array<{ text: string }> }).content[0].text).toContain(
        'not found',
      );
    });
  });

  describe('search_customers', () => {
    it('calls /customers.json with query param (Sapo blocks /customers/search.json as internal-only)', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      await callTool(server, 'search_customers', { query: 'nguyen', limit: 10 });
      expect(client.get).toHaveBeenCalledWith(
        '/customers.json',
        expect.objectContaining({
          params: expect.objectContaining({ query: 'nguyen', limit: 10 }),
        }),
      );
    });

    it('returns paginated envelope', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'search_customers', { query: 'test' });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text).toHaveProperty('data');
      expect(text).toHaveProperty('has_more');
    });
  });

  describe('count_customers', () => {
    it('calls /customers/count.json and returns raw count response', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ count: 42 });

      const result = await callTool(server, 'count_customers', {});
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith(
        '/customers/count.json',
        expect.objectContaining({ params: {} }),
      );
      expect(text.count).toBe(42);
    });
  });

  describe('list_customer_orders', () => {
    it('calls /customers/{id}/orders.json', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ orders: [{ id: 5001 }] });

      const result = await callTool(server, 'list_customer_orders', { customer_id: 1001 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/customers/1001/orders.json', expect.any(Object));
      expect(text.data).toHaveLength(1);
    });

    it('returns isError:true when customer not found', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('Customer'));

      const result = await callTool(server, 'list_customer_orders', { customer_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  describe('create_customer', () => {
    it('POSTs /customers.json with email + phone', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce(singleFixture);

      await callTool(server, 'create_customer', {
        email: 'foo@bar.com',
        phone: '+84900000001',
        first_name: 'Foo',
        last_name: 'Bar',
      });

      expect(client.post).toHaveBeenCalledWith(
        '/customers.json',
        expect.objectContaining({
          customer: expect.objectContaining({
            email: 'foo@bar.com',
            phone: '+84900000001',
            first_name: 'Foo',
            last_name: 'Bar',
          }),
        }),
      );
    });

    it('rejects when neither email nor phone provided', async () => {
      const result = await callTool(server, 'create_customer', { first_name: 'NoContact' });
      expect((result as { isError: boolean }).isError).toBe(true);
      expect(client.post).not.toHaveBeenCalled();
    });

    it('passes inline addresses array to Sapo', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce(singleFixture);

      await callTool(server, 'create_customer', {
        email: 'addr@test.com',
        addresses: [{ address1: '1 Lê Lợi', city: 'TP HCM', country: 'Vietnam' }],
      });

      expect(client.post).toHaveBeenCalledWith(
        '/customers.json',
        expect.objectContaining({
          customer: expect.objectContaining({
            addresses: [
              expect.objectContaining({ address1: '1 Lê Lợi', city: 'TP HCM', country: 'Vietnam' }),
            ],
          }),
        }),
      );
    });

    it('rejects inline addresses with level=2 codes pre-flight', async () => {
      const postSpy = vi.spyOn(client, 'post');
      const result = await callTool(server, 'create_customer', {
        email: 'addr@test.com',
        addresses: [
          { address1: '1 OK', city: 'HN', country: 'Vietnam' },
          {
            address1: '2 Bad',
            city: 'HN',
            country: 'Vietnam',
            province_code: '2001',
            ward_code: '200001',
          },
        ],
      });
      expect((result as { isError: boolean }).isError).toBe(true);
      const text = (result as { content: Array<{ text: string }> }).content[0].text;
      expect(text).toContain('addresses[1]');
      expect(postSpy).not.toHaveBeenCalled();
    });
  });

  describe('update_customer', () => {
    it('PUTs /customers/{id}.json with provided fields only', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce(singleFixture);

      await callTool(server, 'update_customer', {
        customer_id: 1001,
        note: 'VIP',
        tags: 'wholesale,priority',
      });

      expect(client.put).toHaveBeenCalledWith(
        '/customers/1001.json',
        expect.objectContaining({
          customer: { note: 'VIP', tags: 'wholesale,priority' },
        }),
      );
    });

    it('returns isError:true when customer not found', async () => {
      vi.spyOn(client, 'put').mockRejectedValueOnce(new SapoNotFoundError('Customer'));

      const result = await callTool(server, 'update_customer', {
        customer_id: 9999,
        note: 'x',
      });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });
});
