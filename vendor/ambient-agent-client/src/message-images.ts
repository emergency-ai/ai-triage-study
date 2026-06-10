import { isNativeImageFile, type UploadableImage } from "./image-upload";

export interface MessageImage {
  id: string;
  url: string;
  name?: string;
  /** Releases blob URLs created on web; no-op for native `file://` URIs. */
  revoke?: () => void;
}

export function buildMessageImages(images: UploadableImage[]): MessageImage[] {
  const stamp = Date.now();
  return images.map((img, i) => {
    const id = `msg-img-${stamp}-${i}`;
    if (isNativeImageFile(img)) {
      return { id, url: img.uri, name: img.name };
    }
    if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      const url = URL.createObjectURL(img);
      const name = typeof File !== "undefined" && img instanceof File ? img.name : undefined;
      return {
        id,
        url,
        name,
        revoke: () => URL.revokeObjectURL(url),
      };
    }
    return { id, url: "", name: undefined };
  });
}

export function revokeMessageImages(images: MessageImage[] | undefined): void {
  for (const img of images ?? []) {
    img.revoke?.();
  }
}
