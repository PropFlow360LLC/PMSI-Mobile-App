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

export async function uploadPhotoWithQueue({
  getAccessToken,
  customer,
  address,
  unit,
  coNumber,
  file,
  queueOnFailure = true,
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
    await uploadPhotoToFolder(accessToken, folderId, file);
    return { success: true };
  } catch (err) {
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

    return { success: false, queued: true, queueId: id, error: err };
  }
}

export async function processUploadQueue(getAccessToken, { onProgress } = {}) {
  const pending = await getPendingUploads();
  if (!pending.length) return { processed: 0, succeeded: 0, failed: 0 };

  let succeeded = 0;
  let failed = 0;

  for (const item of pending) {
    await updateUploadStatus(item.id, { status: 'uploading' });
    onProgress?.({ id: item.id, status: 'uploading' });

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
      await uploadPhotoToFolder(accessToken, folderId, file);
      await removeUpload(item.id);
      succeeded += 1;
      onProgress?.({ id: item.id, status: 'uploaded' });
    } catch (err) {
      const retries = (item.retries || 0) + 1;
      await updateUploadStatus(item.id, {
        status: 'failed',
        retries,
        lastError: err.message || 'Upload failed',
      });
      failed += 1;
      onProgress?.({ id: item.id, status: 'failed', error: err.message });
    }
  }

  return { processed: pending.length, succeeded, failed };
}
