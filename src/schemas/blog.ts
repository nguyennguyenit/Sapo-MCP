/**
 * BlogSchema — Sapo Blog resource.
 *
 * Sapo conventions:
 * - Timestamps: created_on / modified_on (NOT created_at / updated_at)
 * - .passthrough() for API drift tolerance
 *
 * Endpoint: /admin/blogs.json, /admin/blogs/{id}.json
 */

import { z } from 'zod';

export const BlogSchema = z
  .object({
    id: z.number().int(),
    title: z.string(),
    /** URL handle/slug for the blog */
    handle: z.string().optional().nullable(),
    commentable: z
      .enum(['no', 'moderate', 'yes'])
      .optional()
      .describe('Comment policy: no, moderate (requires approval), yes (open).'),
    feedburner: z.string().optional().nullable(),
    feedburner_location: z.string().optional().nullable(),
    tags: z.string().optional().nullable().describe('Comma-separated tag string.'),
    template_suffix: z.string().optional().nullable(),
    /** SEO meta fields */
    metafield: z.unknown().optional(),
    created_on: z.string(),
    modified_on: z.string(),
  })
  .passthrough();

export type Blog = z.infer<typeof BlogSchema>;

export const BlogSingleResponseSchema = z.object({ blog: BlogSchema }).passthrough();

export const BlogListResponseSchema = z.object({ blogs: z.array(BlogSchema) }).passthrough();
