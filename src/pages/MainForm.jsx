import { useState } from 'react';
import {
  checkDuplicateAddress,
  extractAddressFromFile,
  buildPropertyFolderName,
  buildCoFolderName,
} from '../services/googleDrive';

export default function MainForm({
  user,
  customers,
  selectedCustomer,
  selectedAddress,
  selectedUnit,
  coNumber,
  queueCounts,
  getAccessToken,
  onSelectCustomer,
  onAddressChange,
  onUnitChange,
  onCoNumberChange,
  onOpenCamera,
  onLogout,
  onNotification,
}) {
  const [dupWarning, setDupWarning] = useState(false);
  const [dupFolderName, setDupFolderName] = useState('');
  const [extracting, setExtracting] = useState(false);

  const handleAddressBlur = async () => {
    if (!selectedCustomer || !selectedAddress) {
      setDupWarning(false);
      setDupFolderName('');
      return;
    }

    try {
      const accessToken = await getAccessToken();
      const match = await checkDuplicateAddress(
        accessToken,
        selectedCustomer,
        selectedAddress,
        selectedUnit
      );
      setDupWarning(match.duplicate);
      setDupFolderName(match.folderName || '');
    } catch {
      setDupWarning(false);
      setDupFolderName('');
    }
  };

  const handleFileUploadForAddress = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    try {
      const address = await extractAddressFromFile(file);
      if (address) {
        onAddressChange(address);
        await handleAddressBlur();
      } else {
        onNotification("Couldn't read the document. Try again or type the address manually.", 'error');
      }
    } catch (err) {
      if (err.message?.includes('image')) {
        onNotification('Use a photo for address extraction (PDF/Word coming later).', 'error');
      } else {
        onNotification("Couldn't read the document. Try again or type the address manually.", 'error');
      }
    } finally {
      setExtracting(false);
      e.target.value = '';
    }
  };

  const handleCameraForAddress = async () => {
    onNotification('Camera for address extraction coming soon', 'info');
  };

  const getFolderName = () => {
    const propertyName = buildPropertyFolderName(selectedAddress, selectedUnit);
    if (coNumber?.trim()) {
      return `${propertyName} / ${buildCoFolderName(coNumber)}`;
    }
    return propertyName;
  };

  const queueLabel =
    queueCounts.total > 0
      ? `${queueCounts.pending + queueCounts.failed} queued · ${queueCounts.uploading} uploading`
      : null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #1a2540',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ fontSize: '12px', color: '#7aaad8' }}>
          {user?.name || user?.email || 'User'}
        </div>
        <button
          onClick={onLogout}
          style={{
            background: 'none',
            border: 'none',
            color: '#e53e3e',
            cursor: 'pointer',
            fontSize: '12px',
            textDecoration: 'underline',
          }}
        >
          Sign out
        </button>
      </div>

      {queueLabel && (
        <div style={{
          padding: '8px 16px',
          background: '#1a1000',
          borderBottom: '1px solid #854d0e',
          fontSize: '11px',
          color: '#fbbf24',
        }}>
          📤 Upload queue: {queueLabel}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#4a6fa8', marginBottom: '6px', textTransform: 'uppercase' }}>
            👤 Customer *
          </label>
          <select
            value={selectedCustomer}
            onChange={(e) => {
              onSelectCustomer(e.target.value);
              setDupWarning(false);
            }}
            style={{ width: '100%', padding: '10px 12px', background: '#0f1c34', border: '1px solid #1e3560', borderRadius: '8px', color: '#7aaad8' }}
          >
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#4a6fa8', marginBottom: '6px', textTransform: 'uppercase' }}>
            📍 Property Address *
          </label>
          <input
            type="text"
            placeholder="e.g. 123 Main St"
            value={selectedAddress}
            onChange={(e) => onAddressChange(e.target.value)}
            onBlur={handleAddressBlur}
            style={{ width: '100%', padding: '10px 12px', background: '#0f1c34', border: '1px solid #1e3560', borderRadius: '8px', color: '#7aaad8', marginBottom: '8px' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCameraForAddress}
              style={{
                flex: 1,
                padding: '8px',
                background: '#2a3550',
                border: '1px solid #3a5a70',
                color: '#7aaad8',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              📷 Camera
            </button>
            <label style={{ flex: 1 }}>
              <span
                style={{
                  display: 'block',
                  padding: '8px',
                  background: '#2a3550',
                  border: '1px solid #3a5a70',
                  color: extracting ? '#3a5a70' : '#7aaad8',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: extracting ? 'wait' : 'pointer',
                  textAlign: 'center',
                }}
              >
                {extracting ? 'Reading…' : '📄 Upload image'}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUploadForAddress}
                disabled={extracting}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

        {dupWarning && (
          <div style={{
            background: '#1a1000',
            border: '1.5px solid #854d0e',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '12px',
          }}>
            <div style={{ color: '#fbbf24', fontWeight: '700', marginBottom: '8px' }}>⚠️ Address already exists</div>
            <div style={{ color: '#3a5a70', fontSize: '11px', marginBottom: '6px' }}>
              Existing folder: <span style={{ color: '#7aaad8' }}>{dupFolderName}</span>
            </div>
            <div style={{ color: '#3a5a70', fontSize: '11px', marginBottom: '10px' }}>
              Leave CO# blank to add photos to that folder. Enter a CO# to create a change-order subfolder.
            </div>
            <input
              type="text"
              placeholder="Enter CO# for change order (e.g., 2, 3)"
              value={coNumber}
              onChange={(e) => onCoNumberChange(e.target.value)}
              style={{ width: '100%', padding: '8px', background: '#0f1c34', border: '1px solid #2a3550', borderRadius: '6px', color: '#7aaad8', fontSize: '12px' }}
            />
            <div style={{ fontSize: '10px', color: '#3a5a80', marginTop: '6px' }}>Upload target: {getFolderName()}</div>
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#4a6fa8', marginBottom: '6px', textTransform: 'uppercase' }}>
            🚪 Unit (optional)
          </label>
          <input
            type="text"
            placeholder="e.g. 2b, 3a"
            value={selectedUnit}
            onChange={(e) => onUnitChange(e.target.value)}
            onBlur={handleAddressBlur}
            style={{ width: '100%', padding: '10px 12px', background: '#0f1c34', border: '1px solid #1e3560', borderRadius: '8px', color: '#7aaad8' }}
          />
        </div>

        {selectedCustomer && selectedAddress && (
          <div style={{
            background: '#0a1525',
            border: '1px solid #1a3060',
            borderRadius: '8px',
            padding: '10px 12px',
            marginBottom: '16px',
            fontSize: '11px',
            color: '#3a5a80',
          }}>
            📁 PMSI / <span style={{ color: '#7aaad8' }}>{selectedCustomer}</span> / <span style={{ color: '#7aaad8' }}>{getFolderName()}</span>
          </div>
        )}
      </div>

      <div style={{ padding: '16px', borderTop: '1px solid #1a2540' }}>
        <button
          onClick={onOpenCamera}
          disabled={!selectedCustomer || !selectedAddress}
          style={{
            width: '100%',
            padding: '12px',
            background: selectedCustomer && selectedAddress ? '#008800' : '#004400',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: selectedCustomer && selectedAddress ? 'pointer' : 'not-allowed',
            opacity: selectedCustomer && selectedAddress ? 1 : 0.5,
          }}
        >
          📷 Open Camera
        </button>
      </div>
    </div>
  );
}
