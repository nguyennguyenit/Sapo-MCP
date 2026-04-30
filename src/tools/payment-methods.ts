/**
 * Payment Method tools for pos-counter mode.
 * Registers: list_payment_methods
 *
 * Sapo endpoint: GET /admin/payment_methods.json
 *
 * Status: UNDOCUMENTED in Sapo official docs. Verified working 2026-04-30.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SapoClient } from '../client/http.js';
import { PaymentMethodListResponseSchema } from '../schemas/payment-method.js';
import { errResponse, okResponse } from './tool-response.js';

export function registerPaymentMethodTools(server: McpServer, client: SapoClient): void {
  // ── list_payment_methods ─────────────────────────────────────────────────────
  server.registerTool(
    'list_payment_methods',
    {
      description:
        '[UNDOCUMENTED endpoint, verified 2026-04-30, schema may change] List all configured payment methods for the store (cash, bank transfer, card, etc). For cashiers — use to display payment options at POS counter.',
      inputSchema: {},
    },
    async () => {
      const raw = await client.get('/payment_methods.json');
      const parsed = PaymentMethodListResponseSchema.safeParse(raw);
      if (!parsed.success) return errResponse('Invalid response from Sapo API: payment_methods');
      return okResponse(parsed.data.payment_methods);
    },
  );
}
