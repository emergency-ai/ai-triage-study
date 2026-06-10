/**
 * API base for browser fetch calls.
 * Use same-origin paths so Next.js rewrites proxy to API Gateway (no CORS).
 * The real backend URL is only in next.config.mjs (NEXT_PUBLIC_API_ORIGIN).
 */
export function getClientApiBase(): string {
  return "";
}
