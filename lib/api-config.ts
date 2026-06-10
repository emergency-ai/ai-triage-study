/** Strip trailing slash from an API origin URL. */
function normalizeOrigin(origin: string): string {
  return origin.replace(/\/$/, "");
}

/**
 * API base for browser fetch calls.
 * When NEXT_PUBLIC_API_ORIGIN is set, call API Gateway directly (required for
 * reliable multipart audio uploads — Next.js rewrites can corrupt binary bodies).
 * When unset, use same-origin paths so local rewrites proxy to the backend.
 */
export function getClientApiBase(): string {
  const origin = process.env.NEXT_PUBLIC_API_ORIGIN?.trim();
  if (!origin) return "";
  return normalizeOrigin(origin);
}

export function getApiKey(): string {
  return process.env.NEXT_PUBLIC_API_KEY ?? "";
}
