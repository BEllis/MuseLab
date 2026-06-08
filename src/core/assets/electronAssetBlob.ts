const blobUrlCache = new Map<string, string>();

export function revokeElectronAssetBlobUrl(filePath: string): void {
  const url = blobUrlCache.get(filePath);
  if (!url) return;
  URL.revokeObjectURL(url);
  blobUrlCache.delete(filePath);
}

export async function getElectronAssetBlobUrl(filePath: string): Promise<string> {
  const cached = blobUrlCache.get(filePath);
  if (cached) return cached;

  if (!window.electronAPI?.readAssetFile) {
    throw new Error("Electron asset file API is unavailable");
  }

  const { data, mime } = await window.electronAPI.readAssetFile(filePath);
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  blobUrlCache.set(filePath, url);
  return url;
}
