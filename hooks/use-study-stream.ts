"use client";

import type { ChatTurn } from "@sara/ambient-agent-client";
import { useCallback, useEffect, useRef, useState } from "react";
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
  turns: Array<{ turn_id: string; role: string; text: string; created_at?: number }>,
): ChatTurn[] {
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
    async (audio: UploadableAudio) => runUtterance({ audio }),
    [runUtterance],
  );

  const sendText = useCallback(async (text: string) => runUtterance({ text }), [runUtterance]);

  return { turns, busy, lastError, sendAudio, sendText };
}
