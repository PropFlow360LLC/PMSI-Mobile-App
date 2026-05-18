import { useState, useEffect, useCallback, useRef } from 'react';
import Login from './pages/Login';
import MainForm from './pages/MainForm';
import Camera from './pages/Camera';
import { loadCustomersFromDrive } from './services/googleDrive';
import {
  loadGoogleScript,
  loadSession,
  clearSession,
  revokeAccessToken,
  ensureValidAccessToken,
} from './services/googleAuth';
import { uploadPhotoWithQueue, processUploadQueue } from './services/uploadService';
import { getQueueCounts } from './services/uploadQueue';

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
  const processingQueue = useRef(false);

  const showNotification = useCallback((msg, type) => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const logout = useCallback(() => {
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

  const runQueueProcessor = useCallback(async () => {
    if (processingQueue.current || screen === 'login') return;
    if (!navigator.onLine) return;

    try {
      const session = loadSession();
      if (!session) return;

      processingQueue.current = true;
      const result = await processUploadQueue(getAccessToken);
      await refreshQueueCounts();

      if (result.succeeded > 0) {
        showNotification(`${result.succeeded} queued photo(s) uploaded`, 'success');
      }
    } catch (err) {
      console.error('Queue processing error:', err);
    } finally {
      processingQueue.current = false;
    }
  }, [getAccessToken, refreshQueueCounts, screen, showNotification]);

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
    setAccessToken(session.accessToken);
    setUser(session.user);
    setSessionExpiry(session.expiresAt);
    setScreen('form');
    await loadCustomers(session.accessToken);
    await refreshQueueCounts();
    await runQueueProcessor();
  };

  const handleUploadPhoto = async (file) => {
    if (!selectedCustomer || !selectedAddress) {
      throw new Error('Missing customer or address');
    }

    const result = await uploadPhotoWithQueue({
      getAccessToken,
      customer: selectedCustomer,
      address: selectedAddress,
      unit: selectedUnit,
      coNumber,
      file,
      queueOnFailure: true,
    });

    await refreshQueueCounts();
    return result;
  };

  const handleCameraDone = (photos) => {
    const queued = photos.filter((p) => p.status === 'queued' || p.status === 'failed').length;
    const uploaded = photos.filter((p) => p.status === 'uploaded').length;

    if (queued > 0) {
      showNotification(`${queued} photo(s) queued — will retry when online`, 'error');
    } else if (uploaded > 0) {
      showNotification(`${uploaded} photo(s) uploaded successfully`, 'success');
    }

    setScreen('form');
    runQueueProcessor();
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
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
          getAccessToken={getAccessToken}
          onSelectCustomer={setSelectedCustomer}
          onAddressChange={setSelectedAddress}
          onUnitChange={setSelectedUnit}
          onCoNumberChange={setCoNumber}
          onOpenCamera={() => setScreen('camera')}
          onLogout={logout}
          onNotification={showNotification}
        />
      )}
      {screen === 'camera' && (
        <Camera
          onUploadPhoto={handleUploadPhoto}
          onDone={handleCameraDone}
          onCancel={() => setScreen('form')}
        />
      )}
    </div>
  );
}
