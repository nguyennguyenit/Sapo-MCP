/**
 * Sleep utility — extracted for testability (vi.mock friendly).
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
