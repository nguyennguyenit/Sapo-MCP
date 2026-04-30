/**
 * ScriptTagSchema — Sapo Script Tag resource.
 *
 * Sapo conventions:
 * - Timestamps: created_on / modified_on (NOT created_at / updated_at)
 * - .passthrough() for API drift tolerance
 *
 * Endpoints: /admin/script_tags.json, /admin/script_tags/{id}.json
 */

import { z } from 'zod';

export const ScriptTagSchema = z
  .object({
    id: z.number().int(),
    /** Full URL to the script file loaded on storefront pages */
    src: z.string(),
    /** When the script fires. Currently only 'onload' is supported. */
    event: z.enum(['onload']).optional().default('onload'),
    /** Which storefront pages load this script */
    display_scope: z.enum(['online_store', 'order_status', 'all']).optional().nullable(),
    created_on: z.string(),
    modified_on: z.string(),
  })
  .passthrough();

export type ScriptTag = z.infer<typeof ScriptTagSchema>;

export const ScriptTagSingleResponseSchema = z
  .object({ script_tag: ScriptTagSchema })
  .passthrough();

export const ScriptTagListResponseSchema = z
  .object({ script_tags: z.array(ScriptTagSchema) })
  .passthrough();
