/** Web: `File` / `Blob`. React Native: local file URI (use `appendImage` with expo-file-system `File`). */
export interface NativeImageFile {
  uri: string;
  name: string;
  type: string;
}

export type UploadableImage = Blob | NativeImageFile;

export function isNativeImageFile(image: UploadableImage): image is NativeImageFile {
  return typeof image === "object" && image !== null && "uri" in image;
}

export function appendImageToFormData(form: FormData, image: UploadableImage): void {
  if (isNativeImageFile(image)) {
    form.append("images", {
      uri: image.uri,
      name: image.name,
      type: image.type,
    } as unknown as Blob);
    return;
  }
  const name =
    typeof File !== "undefined" && image instanceof File ? image.name : `image-${Date.now()}.png`;
  form.append("images", image, name);
}
