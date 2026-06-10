"use client";

import type { ChatTurn } from "@sara/ambient-agent-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { postUtterance } from "@/lib/study-api";
import { useApiAuth } from "@/lib/use-api-auth";
import { useAuth } from "@/contexts/auth-context";
import type { UploadableAudio } from "@sara/ambient-agent-client";

export interface UseStudyStream {
  turns: ChatTurn[];
  busy: boolean;
  lastError: string | null;
  sendAudio: (audio: UploadableAudio) => Promise<void>;
  sendText: (text: string) => Promise<void>;
}

export function useStudyStream(conversationId: string | null): UseStudyStream {
  const { apiBase } = useAuth();
  const auth = useApiAuth();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const turnIdRef = useRef(0);

  useEffect(() => {
    setTurns([]);
    setLastError(null);
    turnIdRef.current = 0;
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
          apiBase,
          auth,
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
      } catch (e) {
        setLastError(e instanceof Error ? e.message : String(e));
        setTurns((prev) => prev.filter((t) => t.id !== agentTurnId));
      } finally {
        setBusy(false);
      }
    },
    [apiBase, auth, conversationId],
  );

  const sendAudio = useCallback(
    async (audio: UploadableAudio) => runUtterance({ audio }),
    [runUtterance],
  );

  const sendText = useCallback(async (text: string) => runUtterance({ text }), [runUtterance]);

  return { turns, busy, lastError, sendAudio, sendText };
}
