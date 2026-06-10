"use client";

import type { ChatTurn } from "@sara/ambient-agent-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { updateCachedConversation } from "@/lib/conversation-cache";
import { getConversation, postUtterance } from "@/lib/study-api";
import type { UploadableAudio } from "@sara/ambient-agent-client";

export interface UseStudyStream {
  turns: ChatTurn[];
  busy: boolean;
  lastError: string | null;
  sendAudio: (audio: UploadableAudio) => Promise<void>;
  sendText: (text: string) => Promise<void>;
}

function turnsFromHistory(
  turns: Array<{ turn_id: string; role: string; text: string }>,
): ChatTurn[] {
  return turns.map((t) => ({
    id: t.turn_id,
    role: t.role === "user" ? "user" : "agent",
    text: t.text,
  }));
}

export function useStudyStream(conversationId: string | null): UseStudyStream {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
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
    async (payload: { audio?: UploadableAudio; text?: string }) => {
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
        const result = await postUtterance({
          conversationId,
          ...payload,
        });

        setTurns((prev) =>
          prev.map((t) => {
            if (t.id === userTurnId) return { ...t, text: result.transcript };
            if (t.id === agentTurnId) return { ...t, text: result.profile_text };
            return t;
          }),
        );

        const conv = await getConversation(conversationId);
        updateCachedConversation(conv);
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
    async (audio: UploadableAudio) => runUtterance({ audio }),
    [runUtterance],
  );

  const sendText = useCallback(async (text: string) => runUtterance({ text }), [runUtterance]);

  return { turns, busy, lastError, sendAudio, sendText };
}
