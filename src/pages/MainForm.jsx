import { useState } from 'react';
import AddressScanCamera from '../components/AddressScanCamera';
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
  const [extractError, setExtractError] = useState(null);
  const [showAddressCamera, setShowAddressCamera] = useState(false);

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

  const applyExtracted = async ({ address, unit }) => {
    if (address) onAddressChange(address);
    if (unit) onUnitChange(unit);
    if (address) await handleAddressBlur();
  };

  const runExtraction = async (file) => {
    setExtracting(true);
    setExtractError(null);
    try {
      const { address, unit } = await extractAddressFromFile(file);
      if (address) {
        await applyExtracted({ address, unit });
        onNotification('Address extracted successfully', 'success');
      } else {
        setExtractError('Could not find an address. Try again or type manually.');
        onNotification("Couldn't read the document. Try again or type the address manually.", 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Extraction failed';
      setExtractError(msg);
      onNotification("Couldn't read the document. Try again or type the address manually.", 'error');
    } finally {
      setExtracting(false);
    }
  };

  const handleFileUploadForAddress = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await runExtraction(file);
    e.target.value = '';
  };

  const handleAddressCameraCapture = async (file) => {
    setShowAddressCamera(false);
    await runExtraction(file);
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
    <div className="form-screen">
      <div className="form-screen-header">
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
        <div className="form-screen-queue">
          📤 Upload queue: {queueLabel}
        </div>
      )}

      <div className="form-screen-body">
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
            disabled={extracting}
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
            onChange={(e) => {
              onAddressChange(e.target.value);
              setExtractError(null);
            }}
            onBlur={handleAddressBlur}
            disabled={extracting}
            style={{ width: '100%', padding: '10px 12px', background: '#0f1c34', border: '1px solid #1e3560', borderRadius: '8px', color: '#7aaad8', marginBottom: '8px', opacity: extracting ? 0.6 : 1 }}
          />
          {extracting && (
            <div style={{ fontSize: '11px', color: '#fbbf24', marginBottom: '8px' }}>
              Reading document…
            </div>
          )}
          {extractError && !extracting && (
            <div style={{ fontSize: '11px', color: '#e53e3e', marginBottom: '8px' }}>
              {extractError}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowAddressCamera(true)}
              disabled={extracting}
              style={{
                flex: 1,
                padding: '8px',
                background: '#2a3550',
                border: '1px solid #3a5a70',
                color: extracting ? '#3a5a70' : '#7aaad8',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: extracting ? 'not-allowed' : 'pointer',
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
                  cursor: extracting ? 'not-allowed' : 'pointer',
                  textAlign: 'center',
                }}
              >
                {extracting ? 'Reading…' : '📄 Upload file'}
              </span>
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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
            disabled={extracting}
            style={{ width: '100%', padding: '10px 12px', background: '#0f1c34', border: '1px solid #1e3560', borderRadius: '8px', color: '#7aaad8', opacity: extracting ? 0.6 : 1 }}
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

      <div className="form-screen-footer">
        <button
          type="button"
          onClick={onOpenCamera}
          disabled={!selectedCustomer || !selectedAddress || extracting}
          className="form-primary-btn"
          style={{
            background: selectedCustomer && selectedAddress && !extracting ? '#008800' : '#004400',
            cursor: selectedCustomer && selectedAddress && !extracting ? 'pointer' : 'not-allowed',
          }}
        >
          📷 Open Camera
        </button>
      </div>

      {showAddressCamera && (
        <AddressScanCamera
          onCapture={handleAddressCameraCapture}
          onCancel={() => setShowAddressCamera(false)}
        />
      )}
    </div>
  );
}
