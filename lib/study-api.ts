import { appendAudioToFormData, type UploadableAudio } from "@sara/ambient-agent-client";
import { getApiKey, getClientApiBase } from "@/lib/api-config";

export interface StudyConversation {
  conversation_id: string;
  test_id: string;
  created_at: number;
  updated_at: number;
  turn_count: number;
}

export interface StudyTurn {
  turn_id: string;
  role: string;
  text: string;
  input_mode: string;
  created_at: number;
  profile_json?: Record<string, unknown> | null;
}

export interface TriageResponse {
  transcript: string;
  profile: Record<string, unknown>;
  profile_text: string;
}

function apiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const apiKey = getApiKey();
  if (apiKey) headers["x-api-key"] = apiKey;
  return headers;
}

function apiBase(): string {
  return getClientApiBase();
}

export async function createConversation(testId: string): Promise<StudyConversation> {
  const r = await fetch(`${apiBase()}/ai-triage-study/conversations`, {
    method: "POST",
    headers: { ...apiHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ test_id: testId }),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.detail ?? `create conversation failed: ${r.status}`);
  }
  return r.json();
}

export async function getConversation(
  conversationId: string,
): Promise<StudyConversation & { turns: StudyTurn[] }> {
  const r = await fetch(
    `${apiBase()}/ai-triage-study/conversations/${encodeURIComponent(conversationId)}`,
    { headers: apiHeaders() },
  );
  if (!r.ok) throw new Error(`get conversation failed: ${r.status}`);
  return r.json();
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function postUtterance(args: {
  conversationId: string;
  audio?: UploadableAudio;
  text?: string;
}): Promise<TriageResponse> {
  const form = new FormData();
  if (args.audio && args.audio instanceof Blob) {
    // Base64 text fields avoid API Gateway corrupting multipart binary uploads.
    form.set("audio_base64", await blobToBase64(args.audio));
    form.set("audio_mime", args.audio.type || "audio/wav");
  } else if (args.audio) {
    appendAudioToFormData(form, args.audio);
  } else if (args.text) {
    form.set("text", args.text);
  }

  const r = await fetch(
    `${apiBase()}/ai-triage-study/conversations/${encodeURIComponent(args.conversationId)}/utterances`,
    {
      method: "POST",
      headers: apiHeaders(),
      body: form,
    },
  );
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.detail ?? `utterance failed: ${r.status}`);
  }
  return r.json();
}

export function exportConversationUrl(
  conversationId: string,
  format: "json" | "csv" | "txt",
): string {
  const base = apiBase();
  return `${base}/ai-triage-study/conversations/${encodeURIComponent(conversationId)}/export?format=${format}`;
}

export async function exportConversation(
  conversationId: string,
  format: "json" | "csv" | "txt",
): Promise<Blob> {
  const r = await fetch(exportConversationUrl(conversationId, format), {
    headers: apiHeaders(),
  });
  if (!r.ok) throw new Error(`export failed: ${r.status}`);
  return r.blob();
}

export const TEST_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
