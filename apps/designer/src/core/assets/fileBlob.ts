import { mimeFromExtension } from "../project/assetArchivePaths";

/** Ensure dropped/selected files have a MIME type so <audio> can decode them in the browser. */
export async function fileToStoredBlob(file: File): Promise<Blob> {
  if (file.type) return file;
  const mime = mimeFromExtension(file.name, "");
  if (!mime) return file;
  return new Blob([await file.arrayBuffer()], { type: mime });
}
