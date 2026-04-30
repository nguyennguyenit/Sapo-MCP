/**
 * Tests for registerVariantWriteTools — update_variant
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import { registerVariantWriteTools } from '../../src/tools/variants-write.js';

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

const variantResponse = {
  variant: {
    id: 147237422,
    product_id: 46419129,
    price: 150000,
    sku: 'SKU-001',
    created_on: '2024-01-01T00:00:00Z',
    modified_on: '2024-04-01T00:00:00Z',
  },
};

describe('registerVariantWriteTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerVariantWriteTools(server, client);
  });

  it('registers update_variant', () => {
    const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
      ._registeredTools;
    expect(Object.keys(tools)).toContain('update_variant');
  });

  describe('update_variant', () => {
    it('PUTs to /products/{pid}/variants/{id}.json with variant body', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce(variantResponse);

      await callTool(server, 'update_variant', {
        product_id: 46419129,
        variant_id: 147237422,
        price: 160000,
        sku: 'SKU-002',
      });

      expect(client.put).toHaveBeenCalledWith(
        '/products/46419129/variants/147237422.json',
        expect.objectContaining({
          variant: expect.objectContaining({
            id: 147237422,
            price: 160000,
            sku: 'SKU-002',
          }),
        }),
      );
    });

    it('returns updated variant data', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce(variantResponse);

      const result = await callTool(server, 'update_variant', {
        product_id: 46419129,
        variant_id: 147237422,
        price: 150000,
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);
      expect(text.id).toBe(147237422);
    });

    it('only sends provided fields (no undefined keys)', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce(variantResponse);

      await callTool(server, 'update_variant', {
        product_id: 46419129,
        variant_id: 147237422,
        price: 200000,
      });

      const callArg = (client.put as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
        variant: Record<string, unknown>;
      };
      expect(callArg.variant).not.toHaveProperty('sku');
      expect(callArg.variant).not.toHaveProperty('barcode');
    });

    it('sends compare_at_price when provided', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce(variantResponse);

      await callTool(server, 'update_variant', {
        product_id: 46419129,
        variant_id: 147237422,
        compare_at_price: 200000,
      });

      const callArg = (client.put as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
        variant: Record<string, unknown>;
      };
      expect(callArg.variant.compare_at_price).toBe(200000);
    });

    it('sends weight and requires_shipping when provided', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce(variantResponse);

      await callTool(server, 'update_variant', {
        product_id: 46419129,
        variant_id: 147237422,
        weight: 500,
        requires_shipping: true,
      });

      const callArg = (client.put as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
        variant: Record<string, unknown>;
      };
      expect(callArg.variant.weight).toBe(500);
      expect(callArg.variant.requires_shipping).toBe(true);
    });

    it('returns isError on invalid API response shape', async () => {
      vi.spyOn(client, 'put').mockResolvedValueOnce({ wrong: 'data' });

      const result = await callTool(server, 'update_variant', {
        product_id: 1,
        variant_id: 1,
        price: 100000,
      });
      expect((result as { isError: boolean }).isError).toBe(true);
    });

    it('returns isError on SapoNotFoundError', async () => {
      vi.spyOn(client, 'put').mockRejectedValueOnce(new SapoNotFoundError('Variant'));

      const result = await callTool(server, 'update_variant', {
        product_id: 1,
        variant_id: 9999,
        price: 100000,
      });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });
});
