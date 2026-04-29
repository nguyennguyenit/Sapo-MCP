/**
 * Tests for registerVariantReadTools — list_variants_for_product, get_variant
 *
 * listFixture: real captured from store giapducthangscs (2026-04-30) — 1 variant.
 * singleFixture: handcrafted (id=4001) — shape verified against real embedded variants.
 *
 * For pagination (has_more=true) tests: synthetic 2-item response is used because
 * the real store fixture only contains 1 variant per product. The pagination logic
 * (has_more = items.length === limit) requires ≥2 items when limit=2.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import { registerVariantReadTools } from '../../src/tools/variants-readonly.js';
import listFixture from '../fixtures/sapo/variants/list-response.json' with { type: 'json' };
import singleFixture from '../fixtures/sapo/variants/single.json' with { type: 'json' };

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

/** Synthetic 2-variant fixture for pagination tests (has_more=true requires count === limit). */
function makePaginationFixture() {
  const v1 = listFixture.variants[0];
  const v2 = { ...v1, id: v1.id + 1 };
  return { variants: [v1, v2] };
}

describe('registerVariantReadTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerVariantReadTools(server, client);
  });

  describe('list_variants_for_product', () => {
    it('calls /products/{id}/variants.json', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      await callTool(server, 'list_variants_for_product', { product_id: 3001 });
      expect(client.get).toHaveBeenCalledWith('/products/3001/variants.json', expect.any(Object));
    });

    it('returns paginated envelope with 1 real variant', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(listFixture);

      const result = await callTool(server, 'list_variants_for_product', { product_id: 3001 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      // Real fixture has 1 variant
      expect(text.data).toHaveLength(listFixture.variants.length);
      expect(text).toHaveProperty('has_more');
    });

    it('returns next_since_id when has_more=true (synthetic 2-item response)', async () => {
      // Use synthetic 2-variant fixture so that items.length === limit triggers has_more=true
      const twoVariants = makePaginationFixture();
      vi.spyOn(client, 'get').mockResolvedValueOnce(twoVariants);

      const result = await callTool(server, 'list_variants_for_product', {
        product_id: 3001,
        limit: 2,
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      // has_more=true when returned count equals requested limit
      expect(text.has_more).toBe(true);
      // next_since_id is the last item's id
      expect(text.next_since_id).toBe(twoVariants.variants[1].id);
    });

    it('returns isError:true when product not found', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('Product'));

      const result = await callTool(server, 'list_variants_for_product', { product_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  describe('get_variant', () => {
    it('calls /variants/{id}.json and returns variant', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce(singleFixture);

      const result = await callTool(server, 'get_variant', { variant_id: 4001 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith('/variants/4001.json');
      expect(text.id).toBe(4001);
      expect(text.price).toBe(150000);
    });

    it('returns isError:true on SapoNotFoundError', async () => {
      vi.spyOn(client, 'get').mockRejectedValueOnce(new SapoNotFoundError('Variant'));

      const result = await callTool(server, 'get_variant', { variant_id: 9999 });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });
});
