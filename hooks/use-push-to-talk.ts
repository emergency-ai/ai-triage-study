"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PermissionState = "unknown" | "granted" | "denied" | "prompt";

export interface UsePushToTalkArgs {
  /** Called once with the final audio Blob when the user releases the spacebar. */
  onRecorded: (blob: Blob) => void | Promise<void>;
  /** Called when mic capture begins (spacebar press / point A). */
  onRecordingStart?: () => void;
  /** Disable recording entirely (e.g. while the agent is replying with TTS). */
  disabled?: boolean;
  /** Key to bind to. Defaults to " " (space). */
  key?: string;
}

export interface UsePushToTalk {
  isRecording: boolean;
  permission: PermissionState;
  error: string | null;
  level: number; // 0..1 mic level for the visual indicator
  /** Request mic permission explicitly (used by the permission banner). */
  requestPermission: () => Promise<void>;
}

const MIN_RECORD_MS = 400;
const MIN_BLOB_BYTES = 1000;

/**
 * Hold-spacebar-to-talk. Captures mono PCM via Web Audio API and uploads WAV
 * (not WebM) so ffmpeg on the server always gets a valid container.
 */
export function usePushToTalk({
  onRecorded,
  onRecordingStart,
  disabled,
  key = " ",
}: UsePushToTalkArgs): UsePushToTalk {
  const [isRecording, setIsRecording] = useState(false);
  const [permission, setPermission] = useState<PermissionState>("unknown");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sampleChunksRef = useRef<Float32Array[]>([]);
  const sampleCountRef = useRef(0);
  const capturingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const startingRef = useRef(false);
  const pendingStopRef = useRef(false);
  const recordStartedAtRef = useRef(0);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;
  const onRecordingStartRef = useRef(onRecordingStart);
  onRecordingStartRef.current = onRecordingStart;

  const releaseStream = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    capturingRef.current = false;
    processorRef.current?.disconnect();
    processorRef.current = null;
    analyserRef.current = null;
    sampleChunksRef.current = [];
    sampleCountRef.current = 0;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
  }, []);

  const requestPermission = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const t of stream.getTracks()) t.stop();
      setPermission("granted");
    } catch (e) {
      setPermission("denied");
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const finishCapture = useCallback(async () => {
    capturingRef.current = false;
    const ctx = audioCtxRef.current;
    const sampleRate = ctx?.sampleRate ?? 48_000;
    const total = sampleCountRef.current;
    const merged = new Float32Array(total);
    let pos = 0;
    for (const chunk of sampleChunksRef.current) {
      merged.set(chunk, pos);
      pos += chunk.length;
    }
    sampleChunksRef.current = [];
    sampleCountRef.current = 0;
    releaseStream();
    setIsRecording(false);
    setLevel(0);
    startingRef.current = false;

    const blob = encodeWav(merged, sampleRate);
    if (blob.size >= MIN_BLOB_BYTES) {
      try {
        await onRecordedRef.current(blob);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } else {
      setError("Recording too short — hold space a little longer.");
    }
  }, [releaseStream]);

  const scheduleFinish = useCallback(() => {
    const elapsed = Date.now() - recordStartedAtRef.current;
    const wait = Math.max(0, MIN_RECORD_MS - elapsed);
    window.setTimeout(() => void finishCapture(), wait);
  }, [finishCapture]);

  const startRecording = useCallback(async () => {
    if (isRecording || disabled || startingRef.current) return;
    startingRef.current = true;
    pendingStopRef.current = false;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setPermission("granted");

      // AWS Transcribe Streaming recommends 16 kHz PCM input.
      const ctx = new AudioContext({ sampleRate: 16_000 });
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      analyserRef.current = analyser;

      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      sampleChunksRef.current = [];
      sampleCountRef.current = 0;
      capturingRef.current = true;

      processor.onaudioprocess = (ev) => {
        if (!capturingRef.current) return;
        const input = ev.inputBuffer.getChannelData(0);
        sampleChunksRef.current.push(new Float32Array(input));
        sampleCountRef.current += input.length;
      };

      const silent = ctx.createGain();
      silent.gain.value = 0;
      src.connect(processor);
      processor.connect(silent);
      silent.connect(ctx.destination);

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(buf as unknown as Uint8Array<ArrayBuffer>);
        let sum = 0;
        for (const v of buf) {
          const x = (v - 128) / 128;
          sum += x * x;
        }
        const rms = Math.sqrt(sum / buf.length);
        setLevel(Math.min(1, rms * 3));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      recordStartedAtRef.current = Date.now();
      setIsRecording(true);
      onRecordingStartRef.current?.();
      startingRef.current = false;
      if (pendingStopRef.current) scheduleFinish();
    } catch (e) {
      startingRef.current = false;
      pendingStopRef.current = false;
      setPermission((p) => (p === "granted" ? p : "denied"));
      setError(e instanceof Error ? e.message : String(e));
      releaseStream();
      setIsRecording(false);
    }
  }, [disabled, finishCapture, isRecording, releaseStream, scheduleFinish]);

  const stopRecording = useCallback(() => {
    if (startingRef.current && !audioCtxRef.current) {
      pendingStopRef.current = true;
      return;
    }
    if (capturingRef.current || audioCtxRef.current) {
      scheduleFinish();
      return;
    }
    startingRef.current = false;
    pendingStopRef.current = false;
    releaseStream();
    setIsRecording(false);
    setLevel(0);
  }, [releaseStream, scheduleFinish]);

  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    };
    const onDown = (e: KeyboardEvent) => {
      if (disabled) return;
      if (e.key !== key) return;
      if (e.repeat) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      startRecording();
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key !== key) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      stopRecording();
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") stopRecording();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [disabled, key, startRecording, stopRecording]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const perm = (
          navigator as unknown as {
            permissions?: { query: (q: PermissionDescriptor) => Promise<PermissionStatus> };
          }
        ).permissions;
        if (perm?.query) {
          const status = await perm.query({ name: "microphone" } as PermissionDescriptor);
          if (!cancelled) setPermission(status.state as PermissionState);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => releaseStream(), [releaseStream]);

  return { isRecording, permission, error, level, requestPermission };
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}
