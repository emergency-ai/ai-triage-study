/** Web: MediaRecorder `Blob`. React Native: local file URI (FormData does not support Blob from ArrayBuffer). */
export interface NativeAudioFile {
  uri: string;
  name: string;
  type: string;
}

export type UploadableAudio = Blob | NativeAudioFile;

export function isNativeAudioFile(audio: UploadableAudio): audio is NativeAudioFile {
  return typeof audio === "object" && audio !== null && "uri" in audio;
}

export function guessAudioFileFromUri(uri: string): NativeAudioFile {
  const lower = uri.toLowerCase();
  const stamp = Date.now();
  if (lower.endsWith(".caf")) {
    return { uri, name: `audio-${stamp}.caf`, type: "audio/x-caf" };
  }
  if (lower.endsWith(".mp4") || lower.endsWith(".m4a")) {
    return { uri, name: `audio-${stamp}.m4a`, type: "audio/mp4" };
  }
  if (lower.endsWith(".3gp")) {
    return { uri, name: `audio-${stamp}.3gp`, type: "audio/3gpp" };
  }
  return { uri, name: `audio-${stamp}.m4a`, type: "audio/m4a" };
}

export function appendAudioToFormData(form: FormData, audio: UploadableAudio): void {
  if (isNativeAudioFile(audio)) {
    // Legacy RN `fetch` only. Expo SDK 56 (`expo/fetch`) rejects `{ uri }` parts —
    // use `createApiClient(base, { appendAudio })` with `expo-file-system` `File` on mobile.
    form.append("audio", {
      uri: audio.uri,
      name: audio.name,
      type: audio.type,
    } as unknown as Blob);
    return;
  }
  const ext = audio.type?.split("/")[1]?.split(";")[0] ?? "webm";
  form.append("audio", audio, `audio-${Date.now()}.${ext}`);
}
