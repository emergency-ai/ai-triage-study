export interface WorkflowLatency {
  narrationToTranscriptMs?: number;
  narrationToProfileMs?: number;
  inputMode: "voice" | "text";
  source: "server" | "client" | "mixed";
}

export function logWorkflowLatency(latency: WorkflowLatency): void {
  const { narrationToTranscriptMs, narrationToProfileMs, inputMode, source } = latency;
  console.log("[ai-triage-study] workflow latency", {
    input_mode: inputMode,
    source,
    narration_to_transcript_ms: narrationToTranscriptMs ?? null,
    narration_to_profile_ms: narrationToProfileMs ?? null,
  });
  if (narrationToTranscriptMs != null) {
    console.log(`[ai-triage-study] A→C (narration_to_transcript_ms): ${narrationToTranscriptMs}ms`);
  }
  if (narrationToProfileMs != null) {
    console.log(`[ai-triage-study] A→D (narration_to_profile_ms): ${narrationToProfileMs}ms`);
  }
}

export function resolveWorkflowLatency(args: {
  inputMode: "voice" | "text";
  narrationStartedAt?: number;
  serverTranscriptMs?: number;
  serverProfileMs?: number;
}): WorkflowLatency {
  const clientProfileMs =
    args.narrationStartedAt != null
      ? Math.max(0, Math.round(performance.now() - args.narrationStartedAt))
      : undefined;

  const serverProfileMs = args.serverProfileMs;
  const serverTranscriptMs = args.serverTranscriptMs;

  const narrationToProfileMs = serverProfileMs ?? clientProfileMs;
  const narrationToTranscriptMs =
    serverTranscriptMs ?? (args.inputMode === "text" ? 0 : undefined);

  let source: WorkflowLatency["source"] = "client";
  if (serverProfileMs != null && serverTranscriptMs != null) source = "server";
  else if (serverProfileMs != null || serverTranscriptMs != null) source = "mixed";

  if (source !== "server") {
    console.warn(
      "[ai-triage-study] Backend latency fields missing — showing client A→D only. Redeploy the ai-triage-study Lambda for accurate A→C.",
    );
  }

  return {
    inputMode: args.inputMode,
    narrationToTranscriptMs,
    narrationToProfileMs,
    source,
  };
}

export function applyLatencyToLastAgentTurn(
  turns: Array<{
    id: string;
    role: "user" | "agent";
    text: string;
    inputMode?: string;
    narrationToTranscriptMs?: number | null;
    narrationToProfileMs?: number | null;
  }>,
  latency: Pick<
    WorkflowLatency,
    "inputMode" | "narrationToTranscriptMs" | "narrationToProfileMs"
  >,
) {
  let agentIdx = -1;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role === "agent") {
      agentIdx = i;
      break;
    }
  }
  if (agentIdx === -1) return turns;

  return turns.map((turn, i) => {
    if (i !== agentIdx) return turn;
    return {
      ...turn,
      inputMode: latency.inputMode,
      narrationToTranscriptMs:
        latency.narrationToTranscriptMs ?? turn.narrationToTranscriptMs ?? undefined,
      narrationToProfileMs:
        latency.narrationToProfileMs ?? turn.narrationToProfileMs ?? undefined,
    };
  });
}
