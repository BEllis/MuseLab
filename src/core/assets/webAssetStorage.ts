const DB_NAME = "muselab-assets";
const STORE_NAME = "blobs";
const DB_VERSION = 1;

const objectUrlCache = new Map<string, string>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Failed to open asset database"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = run(store);
        request.onerror = () => reject(request.error ?? new Error("Asset database request failed"));
        request.onsuccess = () => resolve(request.result);
        tx.onerror = () => reject(tx.error ?? new Error("Asset database transaction failed"));
      })
  );
}

export async function putAssetBlob(assetId: string, blob: Blob): Promise<void> {
  await runTransaction("readwrite", (store) => store.put(blob, assetId));
}

export async function getAssetBlob(assetId: string): Promise<Blob | null> {
  const blob = await runTransaction<Blob | undefined>("readonly", (store) => store.get(assetId));
  return blob ?? null;
}

export async function deleteAssetBlob(assetId: string): Promise<void> {
  revokeWebAssetObjectUrl(assetId);
  await runTransaction("readwrite", (store) => store.delete(assetId));
}

export async function listAssetBlobIds(): Promise<string[]> {
  const keys = await runTransaction<IDBValidKey[]>("readonly", (store) => store.getAllKeys());
  return keys.map(String);
}

export async function gcUnusedAssetBlobs(keepIds: Set<string>): Promise<void> {
  const stored = await listAssetBlobIds();
  await Promise.all(
    stored.filter((id) => !keepIds.has(id)).map((id) => deleteAssetBlob(id))
  );
}

export function revokeWebAssetObjectUrl(assetId: string): void {
  const url = objectUrlCache.get(assetId);
  if (!url) return;
  URL.revokeObjectURL(url);
  objectUrlCache.delete(assetId);
}

export async function getWebAssetObjectUrl(assetId: string): Promise<string | null> {
  const cached = objectUrlCache.get(assetId);
  if (cached) return cached;

  const blob = await getAssetBlob(assetId);
  if (!blob) return null;

  const url = URL.createObjectURL(blob);
  objectUrlCache.set(assetId, url);
  return url;
}
