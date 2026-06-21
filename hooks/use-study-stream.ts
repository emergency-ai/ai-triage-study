"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getConversation, postUtterance } from "@/lib/study-api";
import type { UploadableAudio } from "@sara/ambient-agent-client";

export interface StudyChatTurn {
  id: string;
  role: "user" | "agent";
  text: string;
  inputMode?: string;
  narrationToTranscriptMs?: number | null;
  narrationToProfileMs?: number | null;
}

export interface UseStudyStream {
  turns: StudyChatTurn[];
  busy: boolean;
  lastError: string | null;
  sendAudio: (audio: UploadableAudio, options?: { captureToUploadMs?: number }) => Promise<void>;
  sendText: (text: string, options?: { captureToUploadMs?: number }) => Promise<void>;
}

function turnsFromHistory(
  turns: Array<{
    turn_id: string;
    role: string;
    text: string;
    created_at?: number;
    input_mode?: string;
    narration_to_transcript_ms?: number | null;
    narration_to_profile_ms?: number | null;
  }>,
): StudyChatTurn[] {
  return [...turns]
    .sort((a, b) => {
      const at = a.created_at ?? 0;
      const bt = b.created_at ?? 0;
      if (at !== bt) return at - bt;
      const ar = a.role === "user" ? 0 : 1;
      const br = b.role === "user" ? 0 : 1;
      return ar - br;
    })
    .map((t) => ({
      id: t.turn_id,
      role: t.role === "user" ? "user" : "agent",
      text: t.text,
      inputMode: t.input_mode,
      narrationToTranscriptMs: t.narration_to_transcript_ms,
      narrationToProfileMs: t.narration_to_profile_ms,
    }));
}

export function useStudyStream(conversationId: string | null): UseStudyStream {
  const [turns, setTurns] = useState<StudyChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const turnIdRef = useRef(0);

  useEffect(() => {
    setLastError(null);
    turnIdRef.current = 0;
    if (!conversationId) {
      setTurns([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const conv = await getConversation(conversationId);
        if (!cancelled) setTurns(turnsFromHistory(conv.turns));
      } catch {
        if (!cancelled) setTurns([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const runUtterance = useCallback(
    async (payload: {
      audio?: UploadableAudio;
      text?: string;
      captureToUploadMs?: number;
    }) => {
      if (!conversationId) return;
      setBusy(true);
      setLastError(null);

      const userTurnId = `u-${++turnIdRef.current}`;
      const agentTurnId = `a-${++turnIdRef.current}`;
      setTurns((prev) => [
        ...prev,
        { id: userTurnId, role: "user", text: payload.text ?? "" },
        { id: agentTurnId, role: "agent", text: "" },
      ]);

      try {
        await postUtterance({
          conversationId,
          ...payload,
        });

        const conv = await getConversation(conversationId);
        setTurns(turnsFromHistory(conv.turns));
      } catch (e) {
        setLastError(e instanceof Error ? e.message : String(e));
        setTurns((prev) => prev.filter((t) => t.id !== agentTurnId));
      } finally {
        setBusy(false);
      }
    },
    [conversationId],
  );

  const sendAudio = useCallback(
    async (audio: UploadableAudio, options?: { captureToUploadMs?: number }) =>
      runUtterance({ audio, captureToUploadMs: options?.captureToUploadMs }),
    [runUtterance],
  );

  const sendText = useCallback(
    async (text: string, options?: { captureToUploadMs?: number }) =>
      runUtterance({ text, captureToUploadMs: options?.captureToUploadMs ?? 0 }),
    [runUtterance],
  );

  return { turns, busy, lastError, sendAudio, sendText };
}
