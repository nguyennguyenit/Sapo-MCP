/**
 * Basic Auth header builder for Sapo Private App credentials.
 * Sapo uses HTTP Basic Auth: base64(apiKey:apiSecret).
 */

/**
 * Build the Authorization header value for Sapo Private App Basic Auth.
 * @returns "Basic <base64(key:secret)>"
 */
export function buildBasicAuthHeader(apiKey: string, apiSecret: string): string {
  const credentials = `${apiKey}:${apiSecret}`;
  const encoded = Buffer.from(credentials, 'utf-8').toString('base64');
  return `Basic ${encoded}`;
}

/**
 * Mask an Authorization header for safe logging.
 * Replaces token portion with "***".
 * @returns "Basic ***" (or original if not Basic scheme)
 */
export function maskAuthHeader(authHeader: string): string {
  return authHeader.replace(/^Basic\s+\S+$/i, 'Basic ***');
}
