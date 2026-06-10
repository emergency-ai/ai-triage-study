export function getClientApiBase(): string {
  return "";
}

export function getApiKey(): string {
  return process.env.NEXT_PUBLIC_API_KEY ?? "";
}
