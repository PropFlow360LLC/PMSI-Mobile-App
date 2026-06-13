import { useState, useEffect, useCallback, useRef } from 'react';
import Login from './pages/Login';
import MainForm from './pages/MainForm';
import Camera from './pages/Camera';
import ReviewUploads from './pages/ReviewUploads';
import { loadCustomersFromDrive, deleteDriveFile } from './services/googleDrive';
import {
  loadGoogleScript,
  loadSession,
  clearSession,
  revokeAccessToken,
  ensureValidAccessToken,
} from './services/googleAuth';
import {
  uploadPhotoWithQueue,
  processUploadQueue,
  registerUploadAbort,
  cancelUpload,
  cancelQueueProcessing,
} from './services/uploadService';
import {
  getQueueCounts,
  getQueuedUploads,
  retryQueuedUpload,
  removeUpload,
  storedBlobToFile,
} from './services/uploadQueue';

function createPreviewUrl(file) {
  if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
    return URL.createObjectURL(file);
  }
  return null;
}

export default function App() {
  const [screen, setScreen] = useState('login');
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedAddress, setSelectedAddress] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [coNumber, setCoNumber] = useState('');
  const [sessionExpiry, setSessionExpiry] = useState(null);
  const [notification, setNotification] = useState(null);
  const [queueCounts, setQueueCounts] = useState({ total: 0, pending: 0, failed: 0, uploading: 0 });
  const [uploadItems, setUploadItems] = useState([]);
  const [returnScreen, setReturnScreen] = useState('form');
  const [removingId, setRemovingId] = useState(null);
  const processingQueue = useRef(false);
  const skippedQueueIds = useRef(new Set());
  const uploadItemsRef = useRef(uploadItems);

  useEffect(() => {
    uploadItemsRef.current = uploadItems;
  }, [uploadItems]);

  const showNotification = useCallback((msg, type) => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const upsertUploadItem = useCallback((id, updates) => {
    setUploadItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...updates };
        return next;
      }
      return [{ id, createdAt: Date.now(), ...updates }, ...prev];
    });
  }, []);

  const syncQueueToUploadItems = useCallback(async () => {
    const queued = await getQueuedUploads();
    setUploadItems((prev) => {
      const next = [...prev];
      for (const item of queued) {
        const status =
          item.status === 'pending'
            ? 'queued'
            : item.status === 'uploading'
              ? 'uploading'
              : item.status === 'failed'
                ? 'failed'
                : 'queued';
        const existingIdx = next.findIndex((u) => u.queueId === item.id || u.id === item.id);
        let previewUrl = existingIdx >= 0 ? next[existingIdx].previewUrl : null;
        if (!previewUrl && item.blob) {
          const file = storedBlobToFile(item.blob, item.fileName, item.mimeType);
          previewUrl = createPreviewUrl(file);
        }
        const entry = {
          id: item.id,
          queueId: item.id,
          fileName: item.fileName,
          mimeType: item.mimeType,
          previewUrl,
          status,
          error: item.lastError || '',
          source: 'queue',
          createdAt: item.createdAt,
        };
        if (existingIdx >= 0) {
          next[existingIdx] = { ...next[existingIdx], ...entry };
        } else {
          next.unshift(entry);
        }
      }
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    uploadItemsRef.current.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setUploadItems([]);
    setAccessToken((token) => {
      if (token) revokeAccessToken(token);
      return null;
    });
    clearSession();
    setUser(null);
    setCustomers([]);
    setSelectedCustomer('');
    setSelectedAddress('');
    setSelectedUnit('');
    setCoNumber('');
    setSessionExpiry(null);
    setScreen('login');
  }, []);

  const syncSessionFromStorage = useCallback(() => {
    const session = loadSession();
    if (session) {
      setAccessToken(session.accessToken);
      setUser(session.user);
      setSessionExpiry(session.expiresAt);
    }
    return session;
  }, []);

  const getAccessToken = useCallback(async () => {
    const token = await ensureValidAccessToken(() => {
      syncSessionFromStorage();
    });
    setAccessToken(token);
    return token;
  }, [syncSessionFromStorage]);

  const refreshQueueCounts = useCallback(async () => {
    const counts = await getQueueCounts();
    setQueueCounts(counts);
    return counts;
  }, []);

  const handleQueueProgress = useCallback(({ id, status, error, driveFileId }) => {
    if (status === 'cancelled') {
      setUploadItems((prev) => {
        const removed = prev.find((item) => item.queueId === id || item.id === id);
        if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
        return prev.filter((item) => item.queueId !== id && item.id !== id);
      });
      return;
    }

    const mapped =
      status === 'uploaded'
        ? 'completed'
        : status === 'uploading'
          ? 'uploading'
          : status === 'failed'
            ? 'failed'
            : 'queued';

    setUploadItems((prev) =>
      prev.map((item) =>
        item.queueId === id || item.id === id
          ? {
              ...item,
              status: mapped,
              error: error || item.error,
              ...(driveFileId ? { driveFileId } : {}),
            }
          : item
      )
    );
  }, []);

  const runQueueProcessor = useCallback(async () => {
    if (processingQueue.current || screen === 'login') return;
    if (!navigator.onLine) return;

    try {
      const session = loadSession();
      if (!session) return;

      processingQueue.current = true;
      const result = await processUploadQueue(getAccessToken, {
        onProgress: handleQueueProgress,
        shouldSkip: (id) => skippedQueueIds.current.has(id),
      });
      await refreshQueueCounts();
      await syncQueueToUploadItems();

      if (result.succeeded > 0) {
        showNotification(`${result.succeeded} queued file(s) uploaded`, 'success');
      }
    } catch (err) {
      console.error('Queue processing error:', err);
    } finally {
      processingQueue.current = false;
    }
  }, [getAccessToken, refreshQueueCounts, screen, showNotification, handleQueueProgress, syncQueueToUploadItems]);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        await loadGoogleScript();
        const session = loadSession();
        if (!session) return;

        setAccessToken(session.accessToken);
        setUser(session.user);
        setSessionExpiry(session.expiresAt);
        setScreen('form');

        try {
          const token = await getAccessToken();
          await loadCustomers(token);
        } catch {
          await loadCustomers(session.accessToken);
        }

        await refreshQueueCounts();
        await syncQueueToUploadItems();
        await runQueueProcessor();
      } catch (err) {
        console.log('Session restore:', err);
        clearSession();
      }
    };
    restoreSession();
  }, []);

  useEffect(() => {
    const onOnline = () => runQueueProcessor();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [runQueueProcessor]);

  useEffect(() => {
    if (screen === 'form' && accessToken) {
      runQueueProcessor();
    }
  }, [screen, accessToken, runQueueProcessor]);

  useEffect(() => {
    if (screen === 'login') return undefined;

    const interval = setInterval(() => {
      runQueueProcessor();
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [screen, runQueueProcessor]);

  useEffect(() => {
    if (!sessionExpiry) return;
    const timer = setInterval(() => {
      if (Date.now() > sessionExpiry) {
        logout();
        showNotification('Session expired. Please sign in again.', 'error');
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [sessionExpiry, logout, showNotification]);

  const loadCustomers = async (token) => {
    try {
      const custs = await loadCustomersFromDrive(token);
      setCustomers(custs);
      if (!custs.length) {
        showNotification('No customer folders found in PMSI', 'error');
      }
    } catch {
      showNotification('Failed to load customers', 'error');
    }
  };

  const handleLogin = async (session) => {
    if (import.meta.env.DEV || import.meta.env.VITE_AUTH_DEBUG === 'true') {
      console.info('[PMSI Auth] handleLogin', {
        tokenPresent: Boolean(session?.accessToken),
        tokenLengthPresent: Boolean(session?.accessToken?.length),
      });
    }
    setAccessToken(session.accessToken);
    setUser(session.user);
    setSessionExpiry(session.expiresAt);
    setScreen('form');
    await loadCustomers(session.accessToken);
    await refreshQueueCounts();
    await syncQueueToUploadItems();
    await runQueueProcessor();
  };

  const startUpload = useCallback(
    (file, source = 'camera') => {
      if (!selectedCustomer || !selectedAddress) {
        showNotification('Select customer and address first', 'error');
        return null;
      }

      const id = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const previewUrl = createPreviewUrl(file);
      const controller = new AbortController();
      registerUploadAbort(id, controller);

      upsertUploadItem(id, {
        fileName: file.name,
        mimeType: file.type,
        previewUrl,
        status: 'uploading',
        source,
        error: '',
      });

      uploadPhotoWithQueue({
        getAccessToken,
        customer: selectedCustomer,
        address: selectedAddress,
        unit: selectedUnit,
        coNumber,
        file,
        queueOnFailure: true,
        uploadId: id,
        signal: controller.signal,
      })
        .then(async (result) => {
          if (result.cancelled) {
            setUploadItems((prev) => {
              const item = prev.find((i) => i.id === id);
              if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
              return prev.filter((i) => i.id !== id);
            });
            return;
          }
          if (result.success) {
            upsertUploadItem(id, { status: 'completed', driveFileId: result.driveFileId });
          } else if (result.queued) {
            upsertUploadItem(id, {
              status: 'queued',
              queueId: result.queueId,
              error: result.error?.message || '',
            });
          } else {
            upsertUploadItem(id, {
              status: 'failed',
              error: result.error?.message || 'Upload failed',
            });
          }
          await refreshQueueCounts();
          runQueueProcessor();
        })
        .catch(async (err) => {
          upsertUploadItem(id, { status: 'failed', error: err.message || 'Upload failed' });
          await refreshQueueCounts();
        });

      return id;
    },
    [
      selectedCustomer,
      selectedAddress,
      selectedUnit,
      coNumber,
      getAccessToken,
      upsertUploadItem,
      refreshQueueCounts,
      runQueueProcessor,
      showNotification,
    ]
  );

  const handleUploadFromPhone = (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    if (!selectedCustomer || !selectedAddress) {
      showNotification('Select customer and address first', 'error');
      return;
    }

    list.forEach((file) => startUpload(file, 'phone'));
    showNotification(`${list.length} file(s) uploading in background`, 'success');
  };

  const handleRetryUpload = async (queueId) => {
    skippedQueueIds.current.delete(queueId);
    await retryQueuedUpload(queueId);
    setUploadItems((prev) =>
      prev.map((item) =>
        item.queueId === queueId ? { ...item, status: 'queued', error: '' } : item
      )
    );
    await refreshQueueCounts();
    runQueueProcessor();
  };

  const handleRemoveUpload = async (item) => {
    setRemovingId(item.id);
    try {
      if (item.status === 'uploading') {
        cancelUpload(item.id);
        cancelQueueProcessing(item.queueId || item.id);
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      if (item.status === 'completed' && item.driveFileId) {
        const token = await getAccessToken();
        await deleteDriveFile(token, item.driveFileId);
      }

      const queueKey = item.queueId || (item.status !== 'completed' ? item.id : null);
      if (queueKey) {
        skippedQueueIds.current.add(queueKey);
        try {
          await removeUpload(queueKey);
        } catch {
          // Item may already be removed after cancel
        }
      }

      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      setUploadItems((prev) => prev.filter((i) => i.id !== item.id));
      await refreshQueueCounts();

      const deletedFromDrive = item.status === 'completed' && item.driveFileId;
      showNotification(
        deletedFromDrive ? 'Removed from queue and Google Drive' : 'Removed from queue',
        'success'
      );
    } catch (err) {
      showNotification(
        err.response?.data?.error || err.message || 'Failed to remove item',
        'error'
      );
    } finally {
      setRemovingId(null);
    }
  };

  const handleCameraDone = () => {
    const active = uploadItems.filter(
      (p) => p.status === 'queued' || p.status === 'failed' || p.status === 'uploading'
    ).length;
    const uploaded = uploadItems.filter((p) => p.status === 'completed').length;

    if (active > 0) {
      showNotification(`${active} file(s) still uploading or queued — check Review Uploads`, 'error');
    } else if (uploaded > 0) {
      showNotification(`${uploaded} file(s) uploaded successfully`, 'success');
    }

    setScreen('form');
    runQueueProcessor();
  };

  const uploadSummary = {
    uploading: uploadItems.filter((i) => i.status === 'uploading').length,
    queued: uploadItems.filter((i) => i.status === 'queued').length,
    completed: uploadItems.filter((i) => i.status === 'completed').length,
    failed: uploadItems.filter((i) => i.status === 'failed').length,
    total: uploadItems.length,
  };

  return (
    <div className="app-shell">
      {notification && (
        <div
          style={{
            padding: '12px 16px',
            background: notification.type === 'success' ? '#00FF00' : '#FFFF00',
            color: '#000',
            textAlign: 'center',
            fontSize: '14px',
            fontWeight: '600',
          }}
        >
          {notification.msg}
        </div>
      )}

      <div className="app-screen">
        {screen === 'login' && <Login onLogin={handleLogin} onNotification={showNotification} />}
        {screen === 'form' && (
          <MainForm
            user={user}
            customers={customers}
            selectedCustomer={selectedCustomer}
            selectedAddress={selectedAddress}
            selectedUnit={selectedUnit}
            coNumber={coNumber}
            queueCounts={queueCounts}
            uploadSummary={uploadSummary}
            getAccessToken={getAccessToken}
            onSelectCustomer={setSelectedCustomer}
            onAddressChange={setSelectedAddress}
            onUnitChange={setSelectedUnit}
            onCoNumberChange={setCoNumber}
            onOpenCamera={() => setScreen('camera')}
            onUploadFromPhone={handleUploadFromPhone}
            onReviewUploads={() => {
              setReturnScreen('form');
              setScreen('review');
            }}
            onLogout={logout}
            onNotification={showNotification}
          />
        )}
        {screen === 'camera' && (
          <Camera
            propertyAddress={selectedAddress}
            uploadSummary={uploadSummary}
            onUploadFile={(file) => startUpload(file, 'camera')}
            onViewQueue={() => {
              setReturnScreen('camera');
              setScreen('review');
            }}
            onDone={handleCameraDone}
            onCancel={() => setScreen('form')}
          />
        )}
        {screen === 'review' && (
          <ReviewUploads
            uploadItems={uploadItems}
            onBack={() => setScreen(returnScreen)}
            onRetry={handleRetryUpload}
            onRemove={handleRemoveUpload}
            removingId={removingId}
          />
        )}
      </div>
    </div>
  );
}
