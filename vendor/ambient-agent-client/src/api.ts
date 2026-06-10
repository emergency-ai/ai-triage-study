/**
 * MasTER-integrated ambient agent API client.
 * Uses unified API Gateway: `{baseUrl}/ambient/...` with x-api-key + x-user-id.
 */

import { appendAudioToFormData, type UploadableAudio } from "./audio-upload";
import { appendImageToFormData, type UploadableImage } from "./image-upload";
import type { OutputMode, SessionInfo, ToolsResponse } from "./types";

export type { NativeAudioFile, UploadableAudio } from "./audio-upload";
export type { NativeImageFile, UploadableImage } from "./image-upload";

export interface AuthHeaders {
  apiKey: string;
  userId: string;
}

export interface CreateApiClientOptions {
  auth?: AuthHeaders;
  appendAudio?: (form: FormData, audio: UploadableAudio) => void;
  appendImage?: (form: FormData, image: UploadableImage) => void;
  fetch?: typeof fetch;
  /** Use JSON batch responses (API Gateway REST) instead of SSE streaming. */
  responseMode?: "sse" | "batch";
}

export interface JoinedSession {
  master_session_id: string;
  agent_session_id: string;
  role_preset: string;
  chat_id?: string;
  incident_type?: string;
  status?: string;
}

export interface CustomActionSpec {
  action_id: string;
  kind?: "http" | "python";
  tool_name?: string;
  description?: string;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  input_schema?: Record<string, unknown>;
  requires_confirmation?: boolean;
  category?: string;
}

export interface ApiClient {
  bootstrap(): Promise<{ sessions: JoinedSession[]; count: number }>;
  listJoinedSessions(): Promise<{ sessions: JoinedSession[]; count: number }>;
  bindSession(masterSessionId: string, outputMode?: OutputMode): Promise<SessionInfo>;
  setOutputMode(sessionId: string, outputMode: OutputMode): Promise<void>;
  listTools(agentSessionId?: string): Promise<ToolsResponse>;
  listCustomActions(agentSessionId: string): Promise<{ actions: CustomActionSpec[]; count: number }>;
  registerCustomAction(agentSessionId: string, action: Record<string, unknown>): Promise<void>;
  deleteCustomAction(agentSessionId: string, actionId: string): Promise<void>;
  postUtterance(args: PostUtteranceArgs): Promise<Response>;
}

export interface PostUtteranceArgs {
  sessionId: string;
  audio?: UploadableAudio;
  text?: string;
  images?: UploadableImage[];
  language?: string;
}

function authHeaders(auth?: AuthHeaders): Record<string, string> {
  if (!auth) return {};
  return {
    "x-api-key": auth.apiKey,
    "x-user-id": auth.userId,
  };
}

export function createApiClient(
  apiBase: string,
  options: CreateApiClientOptions = {},
): ApiClient {
  const base = apiBase.replace(/\/$/, "");
  const appendAudio = options.appendAudio ?? appendAudioToFormData;
  const appendImage = options.appendImage ?? appendImageToFormData;
  const http = options.fetch ?? fetch;
  const auth = options.auth;
  const responseMode = options.responseMode ?? "batch";

  const jsonHeaders = (): Record<string, string> => ({
    "content-type": "application/json",
    ...authHeaders(auth),
  });

  return {
    async bootstrap() {
      const r = await http(`${base}/ambient/agent/bootstrap`, {
        method: "POST",
        headers: jsonHeaders(),
      });
      if (!r.ok) throw new Error(`bootstrap ${r.status}`);
      return r.json();
    },

    async listJoinedSessions() {
      const r = await http(`${base}/ambient/agent/sessions`, {
        headers: authHeaders(auth),
      });
      if (!r.ok) throw new Error(`listJoinedSessions ${r.status}`);
      return r.json();
    },

    async bindSession(masterSessionId: string, outputMode: OutputMode = "text") {
      const r = await http(`${base}/ambient/agent/bind`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ master_session_id: masterSessionId, output_mode: outputMode }),
      });
      if (!r.ok) throw new Error(`bindSession ${r.status}`);
      const body = await r.json();
      return {
        session_id: body.id,
        state: body.state,
        output_mode: body.output_mode,
        master_session_id: body.master_session_id,
        role_preset: body.role_preset,
      } as SessionInfo;
    },

    async setOutputMode(sessionId: string, outputMode: OutputMode) {
      const r = await http(`${base}/ambient/sessions/${sessionId}/output-mode`, {
        method: "PATCH",
        headers: jsonHeaders(),
        body: JSON.stringify({ output_mode: outputMode }),
      });
      if (!r.ok) throw new Error(`setOutputMode ${r.status}`);
    },

    async listTools(agentSessionId?: string) {
      const q = agentSessionId ? `?agent_session_id=${encodeURIComponent(agentSessionId)}` : "";
      const r = await http(`${base}/ambient/tools${q}`, { headers: authHeaders(auth) });
      if (!r.ok) throw new Error(`listTools ${r.status}`);
      return r.json() as Promise<ToolsResponse>;
    },

    async registerCustomAction(agentSessionId: string, action: Record<string, unknown>) {
      const r = await http(`${base}/ambient/agent/custom-actions`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ agent_session_id: agentSessionId, action }),
      });
      if (!r.ok) throw new Error(`registerCustomAction ${r.status}`);
    },

    async listCustomActions(agentSessionId: string) {
      const q = `?agent_session_id=${encodeURIComponent(agentSessionId)}`;
      const r = await http(`${base}/ambient/agent/custom-actions${q}`, {
        headers: authHeaders(auth),
      });
      if (!r.ok) throw new Error(`listCustomActions ${r.status}`);
      return r.json();
    },

    async deleteCustomAction(agentSessionId: string, actionId: string) {
      const q = `?agent_session_id=${encodeURIComponent(agentSessionId)}`;
      const r = await http(`${base}/ambient/agent/custom-actions/${encodeURIComponent(actionId)}${q}`, {
        method: "DELETE",
        headers: authHeaders(auth),
      });
      if (!r.ok) throw new Error(`deleteCustomAction ${r.status}`);
    },

    async postUtterance(args: PostUtteranceArgs) {
      const hasAudio = !!args.audio;
      const hasText = !!args.text && args.text.trim().length > 0;
      if (hasAudio === hasText) {
        throw new Error("postUtterance requires exactly one of audio or text");
      }

      const form = new FormData();
      if (args.audio) appendAudio(form, args.audio);
      if (args.text) form.append("text", args.text.trim());
      if (args.language) form.append("language", args.language);
      for (const img of args.images ?? []) appendImage(form, img);

      const headers: Record<string, string> = {
        ...authHeaders(auth),
        ...(responseMode === "batch" ? { "x-response-mode": "batch", accept: "application/json" } : {}),
      };

      return http(`${base}/ambient/sessions/${args.sessionId}/utterances`, {
        method: "POST",
        headers,
        body: form,
      });
    },
  };
}
