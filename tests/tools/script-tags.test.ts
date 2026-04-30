/**
 * Tests for registerScriptTagTools — script tags read, write, destructive.
 *
 * Tools tested:
 *   list_script_tags,
 *   create_script_tag,
 *   delete_script_tag (destructive, gated)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SapoNotFoundError } from '../../src/client/errors.js';
import type { SapoClient } from '../../src/client/http.js';
import type { GuardContext } from '../../src/guards.js';
import { registerScriptTagTools } from '../../src/tools/script-tags.js';

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

function makeCtx(allowAll = false): GuardContext {
  return {
    allowOps: allowAll ? new Set(['*' as const]) : new Set(),
  };
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

const scriptTag = {
  id: 20001,
  src: 'https://cdn.example.com/analytics.js',
  event: 'onload',
  display_scope: 'all',
  created_on: '2026-01-10T08:00:00Z',
  modified_on: '2026-04-01T09:00:00Z',
};

describe('registerScriptTagTools', () => {
  let server: McpServer;
  let client: SapoClient;

  beforeEach(() => {
    server = makeServer();
    client = makeClient();
    registerScriptTagTools(server, client, makeCtx(true));
  });

  // ── Tool registration ───────────────────────────────────────────────────────

  it('registers all 3 script tag tools when destructive allowed', () => {
    const tools = (server as unknown as { _registeredTools: Record<string, unknown> })
      ._registeredTools;
    const expected = ['list_script_tags', 'create_script_tag', 'delete_script_tag'];
    for (const name of expected) {
      expect(tools[name], `Tool "${name}" should be registered`).toBeDefined();
    }
  });

  it('does NOT register delete_script_tag when allowOps is empty', () => {
    const restrictedServer = makeServer();
    registerScriptTagTools(restrictedServer, client, makeCtx(false));
    const tools = (restrictedServer as unknown as { _registeredTools: Record<string, unknown> })
      ._registeredTools;
    expect(tools.delete_script_tag).toBeUndefined();
    expect(tools.list_script_tags).toBeDefined();
    expect(tools.create_script_tag).toBeDefined();
  });

  // ── list_script_tags ────────────────────────────────────────────────────────

  describe('list_script_tags', () => {
    it('calls /script_tags.json and returns paginated envelope', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ script_tags: [scriptTag] });

      const result = await callTool(server, 'list_script_tags', { limit: 1 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.get).toHaveBeenCalledWith(
        '/script_tags.json',
        expect.objectContaining({ params: expect.objectContaining({ limit: 1 }) }),
      );
      expect(text.data).toHaveLength(1);
      expect(text.has_more).toBe(true);
      expect(text.next_since_id).toBe(20001);
    });

    it('applies src filter', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ script_tags: [] });

      await callTool(server, 'list_script_tags', { src: 'https://cdn.example.com/analytics.js' });
      expect(client.get).toHaveBeenCalledWith(
        '/script_tags.json',
        expect.objectContaining({
          params: expect.objectContaining({ src: 'https://cdn.example.com/analytics.js' }),
        }),
      );
    });

    it('returns has_more=false when results < limit', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ script_tags: [scriptTag] });

      const result = await callTool(server, 'list_script_tags', { limit: 50 });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.has_more).toBe(false);
      expect(text.next_since_id).toBeNull();
    });

    it('applies since_id cursor', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ script_tags: [] });

      await callTool(server, 'list_script_tags', { since_id: 20000 });
      expect(client.get).toHaveBeenCalledWith(
        '/script_tags.json',
        expect.objectContaining({ params: expect.objectContaining({ since_id: 20000 }) }),
      );
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'get').mockResolvedValueOnce({ bad: 'data' });

      const result = await callTool(server, 'list_script_tags', {});
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  // ── create_script_tag ───────────────────────────────────────────────────────

  describe('create_script_tag', () => {
    it('calls POST /script_tags.json with script_tag body', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ script_tag: scriptTag });

      await callTool(server, 'create_script_tag', {
        src: 'https://cdn.example.com/analytics.js',
      });

      expect(client.post).toHaveBeenCalledWith(
        '/script_tags.json',
        expect.objectContaining({
          script_tag: expect.objectContaining({
            src: 'https://cdn.example.com/analytics.js',
          }),
        }),
      );
    });

    it('returns created script tag', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ script_tag: scriptTag });

      const result = await callTool(server, 'create_script_tag', {
        src: 'https://cdn.example.com/analytics.js',
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(text.id).toBe(20001);
    });

    it('includes display_scope and event when provided', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ script_tag: scriptTag });

      await callTool(server, 'create_script_tag', {
        src: 'https://cdn.example.com/chat.js',
        event: 'onload',
        display_scope: 'online_store',
      });

      expect(client.post).toHaveBeenCalledWith(
        '/script_tags.json',
        expect.objectContaining({
          script_tag: expect.objectContaining({
            event: 'onload',
            display_scope: 'online_store',
          }),
        }),
      );
    });

    it('returns isError on invalid API response', async () => {
      vi.spyOn(client, 'post').mockResolvedValueOnce({ bad: 'data' });

      const result = await callTool(server, 'create_script_tag', {
        src: 'https://cdn.example.com/x.js',
      });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });

  // ── delete_script_tag ───────────────────────────────────────────────────────

  describe('delete_script_tag', () => {
    it('calls DELETE /script_tags/{id}.json and returns deleted=true', async () => {
      vi.spyOn(client, 'delete').mockResolvedValueOnce(undefined);

      const result = await callTool(server, 'delete_script_tag', {
        confirm: true,
        script_tag_id: 20001,
      });
      const text = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);

      expect(client.delete).toHaveBeenCalledWith('/script_tags/20001.json');
      expect(text.deleted).toBe(true);
      expect(text.id).toBe(20001);
    });

    it('returns isError on SapoNotFoundError', async () => {
      vi.spyOn(client, 'delete').mockRejectedValueOnce(new SapoNotFoundError('ScriptTag'));

      const result = await callTool(server, 'delete_script_tag', {
        confirm: true,
        script_tag_id: 9999,
      });
      expect((result as { isError: boolean }).isError).toBe(true);
    });
  });
});
