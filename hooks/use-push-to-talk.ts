"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PermissionState = "unknown" | "granted" | "denied" | "prompt";

export interface UsePushToTalkArgs {
  /** Called once with the final audio Blob when the user releases the spacebar. */
  onRecorded: (blob: Blob) => void | Promise<void>;
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

const TIMESLICE_MS = 200;
const MIN_RECORD_MS = 600;
const FLUSH_BEFORE_STOP_MS = 200;
const MIN_BLOB_BYTES = 800;

/**
 * Hold-spacebar-to-talk. Filters key repeats, ignores presses while a text
 * input is focused, and aborts cleanly if the tab becomes hidden mid-record.
 */
export function usePushToTalk({
  onRecorded,
  disabled,
  key = " ",
}: UsePushToTalkArgs): UsePushToTalk {
  const [isRecording, setIsRecording] = useState(false);
  const [permission, setPermission] = useState<PermissionState>("unknown");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef("audio/webm");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const startingRef = useRef(false);
  const pendingStopRef = useRef(false);
  const recordStartedAtRef = useRef(0);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  const releaseStream = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    analyserRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    recorderRef.current = null;
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

  const finalizeRecorder = useCallback(async (rec: MediaRecorder) => {
    if (rec.state === "inactive") return;
    try {
      if (rec.state === "recording" && typeof rec.requestData === "function") {
        rec.requestData();
        await new Promise((r) => setTimeout(r, FLUSH_BEFORE_STOP_MS));
      }
      if (rec.state === "recording") rec.stop();
    } catch {
      // ignore
    }
  }, []);

  const scheduleFinalize = useCallback(
    (rec: MediaRecorder) => {
      const elapsed = Date.now() - recordStartedAtRef.current;
      const wait = Math.max(0, MIN_RECORD_MS - elapsed);
      window.setTimeout(() => void finalizeRecorder(rec), wait);
    },
    [finalizeRecorder],
  );

  const startRecording = useCallback(async () => {
    if (isRecording || disabled || startingRef.current) return;
    startingRef.current = true;
    pendingStopRef.current = false;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setPermission("granted");

      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

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

      const mime = pickMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mimeTypeRef.current = rec.mimeType || mime || "audio/webm";
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.addEventListener("dataavailable", (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      });
      rec.addEventListener("stop", async () => {
        pendingStopRef.current = false;
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        chunksRef.current = [];
        releaseStream();
        setIsRecording(false);
        setLevel(0);
        startingRef.current = false;
        if (blob.size >= MIN_BLOB_BYTES) {
          try {
            await onRecordedRef.current(blob);
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        } else {
          setError("Recording too short — hold space at least one second.");
        }
      });
      rec.start(TIMESLICE_MS);
      recordStartedAtRef.current = Date.now();
      setIsRecording(true);
      startingRef.current = false;
      if (pendingStopRef.current) scheduleFinalize(rec);
    } catch (e) {
      startingRef.current = false;
      pendingStopRef.current = false;
      setPermission((p) => (p === "granted" ? p : "denied"));
      setError(e instanceof Error ? e.message : String(e));
      releaseStream();
      setIsRecording(false);
    }
  }, [disabled, isRecording, releaseStream, scheduleFinalize]);

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (startingRef.current && !rec) {
      pendingStopRef.current = true;
      return;
    }
    if (rec && rec.state !== "inactive") {
      scheduleFinalize(rec);
      return;
    }
    startingRef.current = false;
    pendingStopRef.current = false;
    releaseStream();
    setIsRecording(false);
    setLevel(0);
  }, [releaseStream, scheduleFinalize]);

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

function pickMime(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return undefined;
}
