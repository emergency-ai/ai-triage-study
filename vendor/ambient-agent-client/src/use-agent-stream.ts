import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { handleAgentEvent, type ChatTurn, type ToolEvent } from "./agent-events";
import {
  createApiClient,
  type ApiClient,
  type AuthHeaders,
  type UploadableAudio,
  type UploadableImage,
} from "./api";
import { formatAgentError } from "./errors";
import { buildMessageImages, revokeMessageImages, type MessageImage } from "./message-images";
import { parseAgentEvents } from "./sse";
import type { FSMState, OutputMode } from "./types";

export type { ChatTurn, MessageImage, ToolEvent };

export interface AudioPlayback {
  playChunk(b64: string, mime: string): void;
  reset(): void;
}

export interface UseAgentStream {
  sessionId: string | null;
  masterSessionId: string | null;
  state: FSMState;
  outputMode: OutputMode;
  setOutputMode: (m: OutputMode) => Promise<void>;
  turns: ChatTurn[];
  busy: boolean;
  lastError: string | null;
  clearLastError: () => void;
  pendingConfirmation: ToolEvent[] | null;
  sendAudio: (audio: UploadableAudio, images?: UploadableImage[]) => Promise<void>;
  sendText: (text: string, images?: UploadableImage[]) => Promise<void>;
}

export interface UseAgentStreamOptions {
  apiBase: string;
  auth: AuthHeaders;
  /** MasTER simulation session to bind. Required before agent is usable. */
  masterSessionId?: string | null;
  api?: ApiClient;
  audio?: AudioPlayback;
  initialOutputMode?: OutputMode;
  responseMode?: "sse" | "batch";
}

const noopAudio: AudioPlayback = {
  playChunk: () => undefined,
  reset: () => undefined,
};

export function useAgentStream({
  apiBase,
  auth,
  masterSessionId = null,
  api: apiOverride,
  audio = noopAudio,
  initialOutputMode = "text",
  responseMode = "batch",
}: UseAgentStreamOptions): UseAgentStream {
  const api = useMemo(
    () =>
      apiOverride ??
      createApiClient(apiBase, {
        auth: { apiKey: auth.apiKey, userId: auth.userId },
        responseMode,
      }),
    [apiBase, apiOverride, auth.apiKey, auth.userId, responseMode],
  );

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [boundMasterSessionId, setBoundMasterSessionId] = useState<string | null>(null);
  const [state, setState] = useState<FSMState>("idle");
  const [outputMode, setOutputModeState] = useState<OutputMode>(initialOutputMode);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<ToolEvent[] | null>(null);
  const previewImagesRef = useRef<MessageImage[]>([]);
  const prevMasterSessionRef = useRef<string | null>(null);

  useEffect(() => {
    const previews = previewImagesRef;
    return () => revokeMessageImages(previews.current);
  }, []);

  useEffect(() => {
    if (!auth.userId) return;
    api.bootstrap().catch(() => undefined);
  }, [api, auth.userId]);

  useEffect(() => {
    if (!masterSessionId || !auth.userId) {
      setSessionId(null);
      setBoundMasterSessionId(null);
      prevMasterSessionRef.current = null;
      return;
    }
    const switchingSession = prevMasterSessionRef.current !== masterSessionId;
    prevMasterSessionRef.current = masterSessionId;
    let cancelled = false;
    api
      .bindSession(masterSessionId, initialOutputMode)
      .then((s) => {
        if (cancelled) return;
        setSessionId(s.session_id);
        setBoundMasterSessionId(masterSessionId);
        setOutputModeState(s.output_mode);
        setState(s.state);
        if (switchingSession) {
          setTurns([]);
          setPendingConfirmation(null);
        }
      })
      .catch((e) =>
        setLastError(formatAgentError(e instanceof Error ? e.message : String(e))),
      );
    return () => {
      cancelled = true;
    };
  }, [api, auth.userId, masterSessionId, initialOutputMode]);

  const switchOutputMode = useCallback(
    async (m: OutputMode) => {
      if (!sessionId) {
        setOutputModeState(m);
        return;
      }
      await api.setOutputMode(sessionId, m);
      setOutputModeState(m);
    },
    [api, sessionId],
  );

  const runUtterance = useCallback(
    async (
      args: { audio: UploadableAudio; text?: undefined } | { text: string; audio?: undefined },
      images?: UploadableImage[],
      initialUserText = "",
    ) => {
      if (!sessionId) {
        const msg = "Agent session is still connecting — wait a moment and try again.";
        setLastError(msg);
        throw new Error(msg);
      }
      if (busy) return;
      setBusy(true);
      setLastError(null);
      audio.reset();

      const userTurnId = `t-user-${Date.now()}`;
      const agentTurnId = `t-agent-${Date.now()}`;
      const messageImages = images?.length ? buildMessageImages(images) : undefined;
      if (messageImages?.length) {
        previewImagesRef.current.push(...messageImages);
      }
      setTurns((prev) => [
        ...prev,
        { id: userTurnId, role: "user", text: initialUserText, images: messageImages },
        { id: agentTurnId, role: "agent", text: "", tools: [] },
      ]);

      const updateAgent = (mutator: (t: ChatTurn) => ChatTurn) => {
        setTurns((prev) => prev.map((t) => (t.id === agentTurnId ? mutator(t) : t)));
      };

      const updateToolById = (toolId: string, mutator: (e: ToolEvent) => ToolEvent) => {
        setTurns((prev) =>
          prev.map((t) => {
            const tools = t.tools;
            if (!tools?.some((x) => x.id === toolId)) return t;
            return { ...t, tools: tools.map((x) => (x.id === toolId ? mutator(x) : x)) };
          }),
        );
      };

      try {
        const r = await api.postUtterance({
          sessionId,
          audio: args.audio,
          text: args.text,
          images,
        });
        if (!r.ok) {
          const detail = await r.text().catch(() => "");
          throw new Error(`Agent request failed (${r.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
        }
        for await (const ev of parseAgentEvents(r)) {
          handleAgentEvent(ev, {
            setState,
            updateAgent,
            updateToolById,
            setUserText: (text) =>
              setTurns((prev) => prev.map((t) => (t.id === userTurnId ? { ...t, text } : t))),
            setPendingConfirmation,
            playAudioChunk: audio.playChunk,
          });
        }
      } catch (e) {
        setLastError(formatAgentError(e instanceof Error ? e.message : String(e)));
      } finally {
        setBusy(false);
      }
    },
    [api, sessionId, busy, audio],
  );

  const sendAudio = useCallback(
    async (audioBlob: UploadableAudio, images?: UploadableImage[]) => {
      await runUtterance({ audio: audioBlob }, images);
    },
    [runUtterance],
  );

  const sendText = useCallback(
    async (text: string, images?: UploadableImage[]) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      await runUtterance({ text: trimmed }, images, trimmed);
    },
    [runUtterance],
  );

  const clearLastError = useCallback(() => setLastError(null), []);

  return {
    sessionId,
    masterSessionId: boundMasterSessionId,
    state,
    outputMode,
    setOutputMode: switchOutputMode,
    turns,
    busy,
    lastError,
    clearLastError,
    pendingConfirmation,
    sendAudio,
    sendText,
  };
}
