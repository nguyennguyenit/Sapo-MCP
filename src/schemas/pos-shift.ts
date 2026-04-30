/**
 * PosShiftSchema — Sapo POS Shift resource.
 *
 * Endpoint: /admin/pos_shifts.json (canonical); alias /admin/pos/shifts.json also works.
 * Status: UNDOCUMENTED in Sapo official docs. Verified working 2026-04-30.
 *
 * Stub fixture — replace with real capture from `npm run capture:fixtures` before 0.2.0 publish.
 * Uses .passthrough() — only id/timestamps/status validated.
 */

import { z } from 'zod';

// Field shape beyond id/created_on/modified_on is unverified — Sapo may use
// `opened_on/closed_on` (Sapo convention) or `opened_at/closed_at`, money may be
// number or string. .passthrough() keeps everything; pin in schema after real capture.
export const PosShiftSchema = z
  .object({
    id: z.number().int(),
    created_on: z.string().optional(),
    modified_on: z.string().optional(),
  })
  .passthrough();

export type PosShift = z.infer<typeof PosShiftSchema>;

export const PosShiftSingleResponseSchema = z.object({ pos_shift: PosShiftSchema }).passthrough();

export type PosShiftSingleResponse = z.infer<typeof PosShiftSingleResponseSchema>;

export const PosShiftListResponseSchema = z
  .object({ pos_shifts: z.array(PosShiftSchema) })
  .passthrough();

export type PosShiftListResponse = z.infer<typeof PosShiftListResponseSchema>;
