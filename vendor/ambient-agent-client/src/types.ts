/**
 * Wire-format event types. Mirrors what `infra/app/api/routes_sessions.py`
 * sends. Add new variants here when the backend grows new event types.
 */

export type FSMState =
  | "idle"
  | "recording"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "awaiting_confirmation"
  | "classifying_intent"
  | "executing_tools"
  | "reporting"
  | "error";

export type OutputMode = "text" | "voice" | "text_audio";

export type AgentEvent =
  | { type: "state_change"; from: FSMState; to: FSMState }
  | { type: "transcript"; text: string }
  | { type: "token"; delta: string }
  | {
      type: "tool_proposed";
      id: string;
      name: string;
      arguments: Record<string, unknown>;
      requires_confirmation: boolean;
    }
  | { type: "tool_started"; id: string; name: string }
  | {
      type: "tool_result";
      id: string;
      name: string;
      ok: boolean;
      summary: string;
      data: unknown;
    }
  | {
      type: "confirmation_decision";
      intent: "affirmative" | "negative_with_suggestion" | "negative_no_suggestion";
      suggestion: string | null;
    }
  | {
      type: "tts_audio";
      mime: string;
      chunk_index: number;
      chunk_b64: string;
    }
  | { type: "tts_done"; chunks: number }
  | { type: "warning"; message: string }
  | { type: "error"; message: string; traceback?: string }
  | { type: "done"; text?: string; turn?: number; finish_reason?: string };

export interface ToolSpec {
  name: string;
  description: string;
  category: string;
  requires_confirmation: boolean;
  input_schema: unknown;
}
export interface ToolsResponse {
  tools: ToolSpec[];
  by_category: Record<string, ToolSpec[]>;
  count: number;
}

export interface SessionInfo {
  session_id: string;
  state: FSMState;
  output_mode: OutputMode;
  master_session_id?: string;
  role_preset?: string;
}
