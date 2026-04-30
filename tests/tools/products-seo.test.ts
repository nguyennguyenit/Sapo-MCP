/**
 * Tests for registerProductSeoTools — SEO-only product update.
 *
 * Tools tested:
 *   update_product_seo
 *
 * Key invariants:
 * - Only SEO fields are sent to the API (no price/stock/variants)
 * - slug is mapped to alias in the request body
 * - handleNotFound wraps 404s correctly
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import { registerProductSeoTools } from '../../src/tools/products-seo.js';

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

// ── Fixtures ────────────────────────────────────────────────────────────────────

const seoResponse = {
  id: 30001,
  meta_title: 'Best Running Shoes 2026 | Sapo Store',
  meta_description: 'Top-rated running shoes with free shipping.',
  alias: 'best-running-shoes-2026',
  tags: 'running,shoes,sport',
  modified_on: '2026-04-30T10:00:00Z',
};

describe('registerProductSeoTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerProductSeoTools(server, client);
  });

  // ── Tool registration ───────────────────────────────────────────────────────

  it('registers update_product_seo tool', () => {
    const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
      ._registeredTools;
    expect(tools.update_product_seo).toBeDefined();
  });

  // ── update_product_seo ──────────────────────────────────────────────────────

  describe('update_product_seo', () => {
    it('calls PUT /products/{id}.json with SEO fields', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce({ product: seoResponse });

      await callTool(server, 'update_product_seo', {
        product_id: 30001,
        meta_title: 'Best Running Shoes 2026 | Sapo Store',
        meta_description: 'Top-rated running shoes with free shipping.',
      });

      expect(client.put).toHaveBeenCalledWith(
        '/products/30001.json',
        expect.objectContaining({
          product: expect.objectContaining({
            meta_title: 'Best Running Shoes 2026 | Sapo Store',
            meta_description: 'Top-rated running shoes with free shipping.',
          }),
        }),
      );
    });

    it('maps slug to alias in the request body', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce({ product: seoResponse });

      await callTool(server, 'update_product_seo', {
        product_id: 30001,
        slug: 'best-running-shoes-2026',
      });

      const callArgs = vi.mocked(client.put).mock.calls[0];
      const body = callArgs[1] as { product: Record<string, unknown> };
      // slug must be sent as alias — Sapo's field name
      expect(body.product.alias).toBe('best-running-shoes-2026');
      expect(body.product.slug).toBeUndefined();
    });

    it('returns updated product SEO response', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce({ product: seoResponse });

      const result = await callTool(server, 'update_product_seo', {
        product_id: 30001,
        tags: 'running,shoes',
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.id).toBe(30001);
      expect(text.alias).toBe('best-running-shoes-2026');
    });

    it('does NOT send price, stock, or variants fields', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce({ product: seoResponse });

      await callTool(server, 'update_product_seo', {
        product_id: 30001,
        meta_title: 'Updated Title',
      });

      const callArgs = vi.mocked(client.put).mock.calls[0];
      const body = callArgs[1] as { product: Record<string, unknown> };
      expect(body.product.price).toBeUndefined();
      expect(body.product.compare_at_price).toBeUndefined();
      expect(body.product.inventory_quantity).toBeUndefined();
      expect(body.product.variants).toBeUndefined();
    });

    it('only sends fields that are provided (no undefined in request body)', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce({ product: seoResponse });

      await callTool(server, 'update_product_seo', {
        product_id: 30001,
        meta_title: 'Only Title',
      });

      const callArgs = vi.mocked(client.put).mock.calls[0];
      const body = callArgs[1] as { product: Record<string, unknown> };
      // Only meta_title should be in the body
      expect(body.product.meta_title).toBe('Only Title');
      expect(body.product.meta_description).toBeUndefined();
      expect(body.product.alias).toBeUndefined();
      expect(body.product.tags).toBeUndefined();
    });

    it('handles all SEO fields together', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce({ product: seoResponse });

      await callTool(server, 'update_product_seo', {
        product_id: 30001,
        meta_title: 'Title',
        meta_description: 'Desc',
        slug: 'my-slug',
        tags: 'tag1,tag2',
      });

      const callArgs = vi.mocked(client.put).mock.calls[0];
      const body = callArgs[1] as { product: Record<string, unknown> };
      expect(body.product).toMatchObject({
        meta_title: 'Title',
        meta_description: 'Desc',
        alias: 'my-slug',
        tags: 'tag1,tag2',
      });
    });

    it('returns isError on SapoNotFoundError', async () => {
      vi.spyOn(client, 'put').mockRejectedValueOnce(new SapoNotFoundError('Product'));

      const result = await callTool(server, 'update_product_seo', {
        product_id: 9999,
        meta_title: 'X',
      });
      expect((result as { isError: boolean }).isError).toBe(true);
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce({ bad: 'data' });

      const result = await callTool(server, 'update_product_seo', {
        product_id: 30001,
        meta_title: 'X',
      });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });
});
