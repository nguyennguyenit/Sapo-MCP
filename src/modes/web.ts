/**
 * Mode: web — storefront/web management tools.
 * Persona: SEO/content team.
 *
 * Batch A (Phase 4): store info, collections (custom+smart), collects
 * Batch B (Phase 4): blogs, articles, pages
 * Batch C (Phase 4): script_tags, products_seo, variants_readonly
 *
 * Tool count (when web mode runs standalone):
 *   31 total with SAPO_ALLOW_OPS=* (all destructive allowed)
 *   25 with SAPO_ALLOW_OPS='' (6 delete tools gated:
 *       delete_custom_collection, delete_collect, delete_blog,
 *       delete_article, delete_page, delete_script_tag)
 *   Note: when combined with pos-online mode, variant tools (2) are not re-registered.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SapoClient } from '../client/http.js';
import type { SapoConfig } from '../config.js';
import type { GuardContext } from '../guards.js';
import { registerArticleTools } from '../tools/articles.js';
import { registerBlogTools } from '../tools/blogs.js';
import { registerCollectionTools } from '../tools/collections.js';
import { registerPageTools } from '../tools/pages.js';
import { registerProductSeoTools } from '../tools/products-seo.js';
import { registerScriptTagTools } from '../tools/script-tags.js';
import { registerStoreInfoTools } from '../tools/store-info.js';
import { registerVariantReadTools } from '../tools/variants-readonly.js';

export function registerWebTools(server: McpServer, client: SapoClient, config: SapoConfig): void {
  const ctx: GuardContext = { allowOps: config.allowOps };

  // Batch A: store info + collections (custom+smart) + collects
  registerStoreInfoTools(server, client);
  registerCollectionTools(server, client, ctx);

  // Batch B: blogs + articles + pages
  registerBlogTools(server, client, ctx);
  registerArticleTools(server, client, ctx);
  registerPageTools(server, client, ctx);

  // Batch C: script tags + products SEO + variant read-only
  registerScriptTagTools(server, client, ctx);
  registerProductSeoTools(server, client);

  // Variant read tools shared with pos-online; registrar is idempotent.
  registerVariantReadTools(server, client);
}
