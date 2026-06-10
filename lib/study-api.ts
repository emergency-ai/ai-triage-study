import { appendAudioToFormData, type UploadableAudio } from "@sara/ambient-agent-client";

export interface AuthHeaders {
  apiKey: string;
  userId: string;
}

export interface StudyConversation {
  conversation_id: string;
  test_id: string;
  user_id: string;
  created_at: number;
  updated_at: number;
  turn_count: number;
}

export interface TriageResponse {
  transcript: string;
  profile: Record<string, unknown>;
  profile_text: string;
}

function headers(auth: AuthHeaders): Record<string, string> {
  return {
    "x-api-key": auth.apiKey,
    "x-user-id": auth.userId,
  };
}

export async function listConversations(
  apiBase: string,
  auth: AuthHeaders,
): Promise<StudyConversation[]> {
  const r = await fetch(`${apiBase.replace(/\/$/, "")}/ai-triage-study/conversations`, {
    headers: headers(auth),
  });
  if (!r.ok) throw new Error(`list conversations failed: ${r.status}`);
  const body = await r.json();
  return body.conversations ?? [];
}

export async function createConversation(
  apiBase: string,
  auth: AuthHeaders,
  testId: string,
): Promise<StudyConversation> {
  const r = await fetch(`${apiBase.replace(/\/$/, "")}/ai-triage-study/conversations`, {
    method: "POST",
    headers: { ...headers(auth), "content-type": "application/json" },
    body: JSON.stringify({ test_id: testId }),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.detail ?? `create conversation failed: ${r.status}`);
  }
  return r.json();
}

export async function postUtterance(args: {
  apiBase: string;
  auth: AuthHeaders;
  conversationId: string;
  audio?: UploadableAudio;
  text?: string;
}): Promise<TriageResponse> {
  const form = new FormData();
  if (args.audio) {
    appendAudioToFormData(form, args.audio);
  } else if (args.text) {
    form.set("text", args.text);
  }

  const r = await fetch(
    `${args.apiBase.replace(/\/$/, "")}/ai-triage-study/conversations/${encodeURIComponent(args.conversationId)}/utterances`,
    {
      method: "POST",
      headers: headers(args.auth),
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
  apiBase: string,
  conversationId: string,
  format: "json" | "csv" | "txt",
): string {
  const base = apiBase.replace(/\/$/, "");
  return `${base}/ai-triage-study/conversations/${encodeURIComponent(conversationId)}/export?format=${format}`;
}

export const TEST_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
