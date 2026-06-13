import {
  resolveUploadFolder,
  uploadPhotoToFolder,
} from './googleDrive';
import {
  enqueueUpload,
  updateUploadStatus,
  removeUpload,
  getPendingUploads,
  storedBlobToFile,
} from './uploadQueue';

const activeUploads = new Map();
let queueAbortController = null;
let queueProcessingId = null;

export function registerUploadAbort(uploadId, controller) {
  activeUploads.set(uploadId, controller);
}

export function cancelUpload(uploadId) {
  const controller = activeUploads.get(uploadId);
  if (controller) {
    controller.abort();
    activeUploads.delete(uploadId);
    return true;
  }
  return false;
}

export function cancelQueueProcessing(itemId) {
  if (queueProcessingId === itemId && queueAbortController) {
    queueAbortController.abort();
    return true;
  }
  return false;
}

function isAbortError(err) {
  return err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || err?.message === 'canceled';
}

export async function uploadPhotoWithQueue({
  getAccessToken,
  customer,
  address,
  unit,
  coNumber,
  file,
  queueOnFailure = true,
  uploadId,
  signal,
}) {
  try {
    const accessToken = await getAccessToken();
    const { folderId } = await resolveUploadFolder(
      accessToken,
      customer,
      address,
      unit,
      coNumber
    );
    const driveFileId = await uploadPhotoToFolder(accessToken, folderId, file, { signal });
    if (uploadId) activeUploads.delete(uploadId);
    return { success: true, driveFileId };
  } catch (err) {
    if (isAbortError(err)) {
      if (uploadId) activeUploads.delete(uploadId);
      return { success: false, cancelled: true };
    }

    if (!queueOnFailure) throw err;

    const id = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await enqueueUpload({
      id,
      blob: file,
      fileName: file.name,
      mimeType: file.type,
      customer,
      address,
      unit: unit || '',
      coNumber: coNumber || '',
      status: 'pending',
      createdAt: Date.now(),
      retries: 0,
      lastError: err.message || 'Upload failed',
    });

    if (uploadId) activeUploads.delete(uploadId);
    return { success: false, queued: true, queueId: id, error: err };
  }
}

export async function processUploadQueue(getAccessToken, { onProgress, shouldSkip } = {}) {
  const pending = await getPendingUploads();
  if (!pending.length) return { processed: 0, succeeded: 0, failed: 0, cancelled: 0 };

  let succeeded = 0;
  let failed = 0;
  let cancelled = 0;

  for (const item of pending) {
    if (shouldSkip?.(item.id)) {
      continue;
    }

    await updateUploadStatus(item.id, { status: 'uploading' });
    onProgress?.({ id: item.id, status: 'uploading' });

    queueProcessingId = item.id;
    queueAbortController = new AbortController();

    try {
      const accessToken = await getAccessToken();
      const file = storedBlobToFile(item.blob, item.fileName, item.mimeType);
      const { folderId } = await resolveUploadFolder(
        accessToken,
        item.customer,
        item.address,
        item.unit,
        item.coNumber
      );
      const driveFileId = await uploadPhotoToFolder(accessToken, folderId, file, {
        signal: queueAbortController.signal,
      });
      await removeUpload(item.id);
      succeeded += 1;
      onProgress?.({ id: item.id, status: 'uploaded', driveFileId });
    } catch (err) {
      if (isAbortError(err)) {
        await removeUpload(item.id);
        cancelled += 1;
        onProgress?.({ id: item.id, status: 'cancelled' });
      } else {
        const retries = (item.retries || 0) + 1;
        await updateUploadStatus(item.id, {
          status: 'failed',
          retries,
          lastError: err.message || 'Upload failed',
        });
        failed += 1;
        onProgress?.({ id: item.id, status: 'failed', error: err.message });
      }
    } finally {
      queueProcessingId = null;
      queueAbortController = null;
    }
  }

  return { processed: pending.length, succeeded, failed, cancelled };
}
