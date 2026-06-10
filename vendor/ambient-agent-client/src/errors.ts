/** Turn raw API / network errors into a short user-facing string. */
export function formatAgentError(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "Something went wrong.";

  const jsonTail = trimmed.match(/:\s*(\{[\s\S]*\})\s*$/);
  if (jsonTail) {
    try {
      const parsed = JSON.parse(jsonTail[1]) as {
        error?: { message?: string };
        message?: string;
      };
      const inner = parsed.error?.message ?? parsed.message;
      if (typeof inner === "string" && inner.trim()) return inner.trim();
    } catch {
      /* fall through */
    }
  }

  const withoutPrefix = trimmed.replace(/^postUtterance\s+\d+:\s*/i, "").trim();
  if (withoutPrefix !== trimmed) return truncate(withoutPrefix, 160);

  return truncate(trimmed, 200);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
