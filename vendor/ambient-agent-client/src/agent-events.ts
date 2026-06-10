import { formatAgentError } from "./errors";
import type { MessageImage } from "./message-images";
import type { AgentEvent, FSMState } from "./types";

export type { MessageImage };

export interface ToolEvent {
  id: string;
  name: string;
  arguments?: Record<string, unknown>;
  ok?: boolean;
  summary?: string;
  data?: unknown;
  requires_confirmation?: boolean;
  status: "proposed" | "running" | "done" | "failed";
}

export interface ChatTurn {
  id: string;
  role: "user" | "agent";
  text: string;
  /** Local previews of images bundled with this user utterance. */
  images?: MessageImage[];
  tools?: ToolEvent[];
}

export interface AgentEventHandlerCtx {
  setState: (s: FSMState) => void;
  updateAgent: (m: (t: ChatTurn) => ChatTurn) => void;
  updateToolById: (id: string, m: (e: ToolEvent) => ToolEvent) => void;
  setUserText: (t: string) => void;
  setPendingConfirmation: (v: ToolEvent[] | null) => void;
  playAudioChunk: (b64: string, mime: string) => void;
}

export function handleAgentEvent(ev: AgentEvent, ctx: AgentEventHandlerCtx) {
  switch (ev.type) {
    case "state_change":
      ctx.setState(ev.to);
      if (ev.to !== "awaiting_confirmation") ctx.setPendingConfirmation(null);
      return;
    case "transcript":
      ctx.setUserText(ev.text);
      return;
    case "token":
      ctx.updateAgent((t) => ({ ...t, text: t.text + ev.delta }));
      return;
    case "tool_proposed": {
      const tool: ToolEvent = {
        id: ev.id,
        name: ev.name,
        arguments: ev.arguments,
        requires_confirmation: ev.requires_confirmation,
        status: "proposed",
      };
      ctx.updateAgent((t) => ({ ...t, tools: [...(t.tools ?? []), tool] }));
      if (ev.requires_confirmation) {
        ctx.setPendingConfirmation([tool]);
      }
      return;
    }
    case "tool_started":
      ctx.updateToolById(ev.id, (x) => ({ ...x, status: "running" }));
      return;
    case "tool_result":
      ctx.updateToolById(ev.id, (x) => ({
        ...x,
        status: ev.ok ? "done" : "failed",
        ok: ev.ok,
        summary: ev.summary,
        data: ev.data,
      }));
      return;
    case "confirmation_decision":
      ctx.setPendingConfirmation(null);
      return;
    case "tts_audio":
      ctx.playAudioChunk(ev.chunk_b64, ev.mime);
      return;
    case "tts_done":
      return;
    case "warning":
      ctx.updateAgent((t) => ({ ...t, text: `${t.text}\n[warning] ${ev.message}` }));
      return;
    case "error":
      ctx.updateAgent((t) => ({
        ...t,
        text: `${t.text}\n[error] ${formatAgentError(ev.message)}`,
      }));
      return;
    case "done":
      return;
  }
}
