const DB_NAME = 'pmsi-upload-queue';
const DB_VERSION = 1;
const STORE_NAME = 'uploads';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

export async function enqueueUpload(item) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve(item.id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedUploads() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const items = (request.result || []).sort((a, b) => a.createdAt - b.createdAt);
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingUploads() {
  const all = await getQueuedUploads();
  return all.filter((item) => item.status === 'pending' || item.status === 'failed');
}

export async function updateUploadStatus(id, updates) {
  const db = await openDb();
  const existing = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  if (!existing) return null;

  const updated = { ...existing, ...updates };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(updated);
    tx.oncomplete = () => resolve(updated);
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeUpload(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueueCounts() {
  const all = await getQueuedUploads();
  return {
    total: all.length,
    pending: all.filter((i) => i.status === 'pending').length,
    failed: all.filter((i) => i.status === 'failed').length,
    uploading: all.filter((i) => i.status === 'uploading').length,
  };
}

export function fileToStoredBlob(file) {
  return file;
}

export function storedBlobToFile(blob, fileName, mimeType) {
  return new File([blob], fileName, { type: mimeType || 'image/jpeg' });
}
