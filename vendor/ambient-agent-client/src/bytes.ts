type BufferLike = {
  from(data: string, encoding: "base64"): Uint8Array;
  from(data: Uint8Array): { toString(encoding: "base64"): string };
};

function getBuffer(): BufferLike | undefined {
  return (globalThis as { Buffer?: BufferLike }).Buffer;
}

export function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const buf = getBuffer();
  if (buf) return new Uint8Array(buf.from(b64, "base64"));
  throw new Error("base64ToBytes: no atob or Buffer available");
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }
  const buf = getBuffer();
  if (buf) return buf.from(bytes).toString("base64");
  throw new Error("bytesToBase64: no btoa or Buffer available");
}

export function concatBytes(buffers: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const b of buffers) total += b.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const b of buffers) {
    out.set(b, off);
    off += b.length;
  }
  return out;
}
