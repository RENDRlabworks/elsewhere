"use client";

/** The first image in a paste or drop, from any source a browser hands over. */
export function imageFrom(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const f = item.getAsFile();
      if (f) return f;
    }
  }
  return Array.from(data.files ?? []).find((f) => f.type.startsWith("image/")) ?? null;
}

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };

/** A clipboard blob as a file the upload routes accept. */
export const namedImage = (blob: Blob) => new File([blob], `pasted-photo.${EXT[blob.type] ?? "png"}`, { type: blob.type || "image/png" });

/** Whether the browser can read images from the clipboard on a button press. */
export const canReadClipboard = () => typeof navigator !== "undefined" && !!navigator.clipboard && typeof navigator.clipboard.read === "function";

/** Read the first image on the clipboard. Null when there is none; throws when reading is refused. */
export async function readClipboardImage(): Promise<File | null> {
  for (const item of await navigator.clipboard.read()) {
    const type = item.types.find((t) => t.startsWith("image/"));
    if (type) return namedImage(await item.getType(type));
  }
  return null;
}
