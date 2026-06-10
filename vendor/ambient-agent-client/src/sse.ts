/**
 * Parse agent events from SSE stream or JSON batch (API Gateway REST).
 */

import type { AgentEvent } from "./types";

function normalizeAgentEvent(raw: unknown): AgentEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.type === "string") return raw as AgentEvent;
  // Legacy batch wire format: { event, data: "<json>" }
  if (typeof obj.event === "string" && typeof obj.data === "string") {
    try {
      return JSON.parse(obj.data) as AgentEvent;
    } catch {
      return null;
    }
  }
  return null;
}

export async function* parseAgentEvents(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<AgentEvent, void, void> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await response.json()) as { events?: unknown[] };
    for (const raw of body.events ?? []) {
      if (signal?.aborted) return;
      const ev = normalizeAgentEvent(raw);
      if (ev) yield ev;
    }
    return;
  }
  yield* parseSSE(response, signal);
}

export async function* parseSSE(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<AgentEvent, void, void> {
  if (!response.body) throw new Error("response has no body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) {
        reader.cancel().catch(() => undefined);
        return;
      }
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const idx = indexOfTerminator(buffer);
        if (idx < 0) break;
        const rawMessage = buffer.slice(0, idx);
        buffer = buffer.slice(idx + (buffer.startsWith("\r", idx) ? 4 : 2));
        const ev = decodeMessage(rawMessage);
        if (ev) yield ev;
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

function indexOfTerminator(s: string): number {
  const a = s.indexOf("\n\n");
  const b = s.indexOf("\r\n\r\n");
  if (a < 0) return b;
  if (b < 0) return a;
  return Math.min(a, b);
}

function decodeMessage(raw: string): AgentEvent | null {
  if (!raw) return null;
  let dataPart = "";
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("data:")) {
      const v = line.slice(5).trimStart();
      dataPart = dataPart ? `${dataPart}\n${v}` : v;
    }
  }
  if (!dataPart) return null;
  try {
    return JSON.parse(dataPart) as AgentEvent;
  } catch {
    return null;
  }
}
