/**
 * Script tag tools for web mode (SEO/content team persona).
 * Registers: list_script_tags (R)
 *            create_script_tag (S)
 *            delete_script_tag (D — gated via SAPO_ALLOW_OPS=delete + confirm:true)
 *
 * Endpoints:
 *   GET    /admin/script_tags.json
 *   POST   /admin/script_tags.json
 *   DELETE /admin/script_tags/{id}.json
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SapoClient } from '../client/http.js';
import type { GuardContext } from '../guards.js';
import { registerIfAllowed } from '../guards.js';
import {
  ScriptTagListResponseSchema,
  ScriptTagSingleResponseSchema,
} from '../schemas/script-tag.js';
import { errResponse, handleNotFound, okResponse } from './tool-response.js';

// ── Read tools ─────────────────────────────────────────────────────────────────

function registerScriptTagReadTools(server: McpServer, client: SapoClient): void {
  server.registerTool(
    'list_script_tags',
    {
      description:
        'List all script tags injected into the storefront. For SEO/content team: ' +
        'audit third-party analytics, chat widgets, and tracking scripts. ' +
        'Paginated via since_id cursor.',
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(250)
          .optional()
          .describe('Max results per page (default 50, max 250).'),
        since_id: z
          .number()
          .int()
          .optional()
          .describe('Return script tags with ID greater than this value (cursor pagination).'),
        src: z.string().optional().describe('Filter by exact script source URL.'),
      },
    },
    async (args) => {
      const limit = args.limit ?? 50;
      const params: Record<string, string | number | undefined> = { limit };
      if (args.since_id !== undefined) params.since_id = args.since_id;
      if (args.src) params.src = args.src;

      const raw = await client.get('/script_tags.json', { params });
      const parsed = ScriptTagListResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: script tags list');

      const items = parsed.data.script_tags;
      const has_more = items.length === limit;
      const last = items[items.length - 1];
      return okResponse({
        data: items,
        has_more,
        next_since_id: has_more && last ? last.id : null,
      });
    },
  );
}

// ── Write tools (create) ───────────────────────────────────────────────────────

function registerScriptTagWriteTools(server: McpServer, client: SapoClient): void {
  server.registerTool(
    'create_script_tag',
    {
      description:
        'Inject a new JavaScript file into the storefront. For SEO/content team: ' +
        'add analytics, chat widgets, or conversion tracking scripts. ' +
        'Specify the hosted script URL and the page scope.',
      inputSchema: {
        src: z.string().url().describe('Full URL to the hosted JavaScript file. Required.'),
        event: z
          .enum(['onload'])
          .optional()
          .describe('When the script fires. Only "onload" is supported. Defaults to "onload".'),
        display_scope: z
          .enum(['online_store', 'order_status', 'all'])
          .optional()
          .describe(
            'Which pages load this script: online_store, order_status, or all. Defaults to all.',
          ),
      },
    },
    async (args) => {
      const body: Record<string, unknown> = { src: args.src };
      if (args.event !== undefined) body.event = args.event;
      if (args.display_scope !== undefined) body.display_scope = args.display_scope;

      const raw = await client.post('/script_tags.json', { script_tag: body });
      const parsed = ScriptTagSingleResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: create script tag');
      return okResponse(parsed.data.script_tag);
    },
  );
}

// ── Destructive tools (delete) ─────────────────────────────────────────────────

function registerScriptTagDestructiveTools(
  server: McpServer,
  client: SapoClient,
  ctx: GuardContext,
): void {
  registerIfAllowed(
    server,
    {
      name: 'delete_script_tag',
      category: 'delete',
      description:
        '[DESTRUCTIVE: delete] Permanently remove a script tag from the storefront. Cannot be undone. ' +
        'The script will stop loading on all store pages immediately. ' +
        'Requires SAPO_ALLOW_OPS=delete AND confirm:true.',
      inputSchema: {
        confirm: z
          .literal(true)
          .describe('Must be true. Explicit confirmation required for destructive operations.'),
        script_tag_id: z.number().int().describe('Script tag ID to delete. Required.'),
      },
      handler: async (args) => {
        return handleNotFound(async () => {
          await client.delete(`/script_tags/${args.script_tag_id}.json`);
          return okResponse({ deleted: true, id: args.script_tag_id });
        }, 'ScriptTag');
      },
    },
    ctx,
  );
}

// ── Main register function ─────────────────────────────────────────────────────

export function registerScriptTagTools(
  server: McpServer,
  client: SapoClient,
  ctx: GuardContext,
): void {
  registerScriptTagReadTools(server, client);
  registerScriptTagWriteTools(server, client);
  registerScriptTagDestructiveTools(server, client, ctx);
}
