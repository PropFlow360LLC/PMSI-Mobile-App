import { useState, useEffect } from 'react';
import Login from './pages/Login';
import MainForm from './pages/MainForm';
import Camera from './pages/Camera';
import { initGoogleAuth, loadCustomersFromDrive } from './services/googleDrive';

export default function App() {
  const [screen, setScreen] = useState('login'); // login, form, camera
  const [user, setUser] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [sessionExpiry, setSessionExpiry] = useState(null);
  const [notification, setNotification] = useState(null);

  // Initialize Google auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        const gAuth = window.gapi && window.gapi.auth2 ? window.gapi.auth2.getAuthInstance() : null;
        if (gAuth && gAuth.isSignedIn.get()) {
          const profile = gAuth.currentUser.get().getBasicProfile();
          setUser(profile);
          loadCustomers(gAuth.currentUser.get());
          // Set 8-hour expiry
          setSessionExpiry(Date.now() + 8 * 60 * 60 * 1000);
        }
      } catch (err) {
        console.log('Auth init:', err);
      }
    };
    initAuth();
  }, []);

  // Check session expiry
  useEffect(() => {
    if (!sessionExpiry) return;
    const timer = setInterval(() => {
      if (Date.now() > sessionExpiry) {
        logout();
      }
    }, 60000); // Check every minute
    return () => clearInterval(timer);
  }, [sessionExpiry]);

  const loadCustomers = async (currentUser) => {
    try {
      const token = currentUser.getAuthResponse().id_token;
      const custs = await loadCustomersFromDrive(token);
      setCustomers(custs);
    } catch (err) {
      showNotification('Failed to load customers', 'error');
    }
  };

  const handleLogin = async (user) => {
    setUser(user);
    setScreen('form');
    loadCustomers(user);
    setSessionExpiry(Date.now() + 8 * 60 * 60 * 1000);
  };

  const handleLogout = () => {
    logout();
  };

  const logout = () => {
    setUser(null);
    setSelectedCustomer(null);
    setSelectedAddress('');
    setSelectedUnit('');
    setCapturedPhotos([]);
    setScreen('login');
  };

  const handleCameraOpen = () => {
    setScreen('camera');
  };

  const handleCameraDone = async (photos) => {
    setCapturedPhotos(photos);
    await uploadPhotos(photos);
    setCapturedPhotos([]);
    setScreen('form');
    showNotification('✅ All set! Your uploads sent successfully.', 'success');
  };

  const uploadPhotos = async (photos) => {
    // Upload to Google Drive
    // PMSI / [Customer] / [Address] or [Address - CO#] or [Address - Unit X]
  };

  const showNotification = (msg, type) => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {notification && (
        <div style={{
          padding: '12px 16px',
          background: notification.type === 'success' ? '#00FF00' : '#FFFF00',
          color: '#000',
          textAlign: 'center',
          fontSize: '14px',
          fontWeight: '600'
        }}>
          {notification.msg}
        </div>
      )}

      {screen === 'login' && <Login onLogin={handleLogin} />}
      {screen === 'form' && (
        <MainForm
          user={user}
          customers={customers}
          selectedCustomer={selectedCustomer}
          selectedAddress={selectedAddress}
          selectedUnit={selectedUnit}
          onSelectCustomer={setSelectedCustomer}
          onAddressChange={setSelectedAddress}
          onUnitChange={setSelectedUnit}
          onOpenCamera={handleCameraOpen}
          onLogout={handleLogout}
          onNotification={showNotification}
        />
      )}
      {screen === 'camera' && (
        <Camera
          customer={selectedCustomer}
          address={selectedAddress}
          unit={selectedUnit}
          onDone={handleCameraDone}
          onCancel={() => setScreen('form')}
        />
      )}
    </div>
  );
}
