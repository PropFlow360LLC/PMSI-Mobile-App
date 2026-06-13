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
  uploadSummary,
  getAccessToken,
  onSelectCustomer,
  onAddressChange,
  onUnitChange,
  onCoNumberChange,
  onOpenCamera,
  onUploadFromPhone,
  onReviewUploads,
  onLogout,
  onNotification,
}) {
  const [dupWarning, setDupWarning] = useState(false);
  const [dupFolderName, setDupFolderName] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState(null);
  const [showAddressCamera, setShowAddressCamera] = useState(false);

  const canUpload = Boolean(selectedCustomer && selectedAddress);

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

  const getFolderName = () => {
    const propertyName = buildPropertyFolderName(selectedAddress, selectedUnit);
    if (coNumber?.trim()) {
      return `${propertyName} / ${buildCoFolderName(coNumber)}`;
    }
    return propertyName;
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
        onNotification('Address extracted — review and edit if needed', 'success');
      } else {
        setExtractError('Could not find an address. Try again or type manually.');
        onNotification("Couldn't read the image. Try again or type the address manually.", 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Extraction failed';
      setExtractError(msg);
      onNotification("Couldn't read the image. Try again or type the address manually.", 'error');
    } finally {
      setExtracting(false);
    }
  };

  const handleAddressCameraCapture = async (file) => {
    setShowAddressCamera(false);
    await runExtraction(file);
  };

  const hasUploadActivity =
    uploadSummary.uploading > 0 ||
    uploadSummary.queued > 0 ||
    uploadSummary.failed > 0 ||
    queueCounts.total > 0;
  const queueLabel = hasUploadActivity
    ? `${uploadSummary.queued + queueCounts.pending + queueCounts.failed} queued · ${uploadSummary.uploading + queueCounts.uploading} uploading`
    : null;

  const handlePhoneFiles = (e) => {
    const files = e.target.files;
    if (files?.length) {
      onUploadFromPhone(files);
    }
    e.target.value = '';
  };

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
        <button type="button" className="form-screen-queue form-screen-queue-btn" onClick={onReviewUploads}>
          <span>📤 Upload queue: {queueLabel}</span>
          <span className="form-queue-chevron">›</span>
        </button>
      )}

      <div className="form-screen-body">
        <div style={{ marginBottom: '16px' }}>
          <label className="form-label">👤 Customer *</label>
          <select
            value={selectedCustomer}
            onChange={(e) => {
              onSelectCustomer(e.target.value);
              setDupWarning(false);
            }}
            disabled={extracting}
          >
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label className="form-label">📍 Property Address *</label>
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
            style={{ opacity: extracting ? 0.6 : 1 }}
          />
          {extracting && (
            <div style={{ fontSize: '11px', color: '#fbbf24', marginTop: '8px' }}>
              Reading image…
            </div>
          )}
          {extractError && !extracting && (
            <div style={{ fontSize: '11px', color: '#e53e3e', marginTop: '8px' }}>
              {extractError}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowAddressCamera(true)}
            disabled={extracting}
            className="form-scan-address-btn"
          >
            📷 Scan scope / work order
          </button>
        </div>

        {dupWarning && (
          <div className="form-dup-warning">
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
              style={{ fontSize: '12px' }}
            />
            <div style={{ fontSize: '10px', color: '#3a5a80', marginTop: '6px' }}>Upload target: {getFolderName()}</div>
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label className="form-label">🚪 Unit (optional)</label>
          <input
            type="text"
            placeholder="e.g. 2b, 3a"
            value={selectedUnit}
            onChange={(e) => onUnitChange(e.target.value)}
            onBlur={handleAddressBlur}
            disabled={extracting}
            style={{ opacity: extracting ? 0.6 : 1 }}
          />
        </div>

        {selectedCustomer && selectedAddress && (
          <div className="form-folder-path">
            📁 PMSI / <span>{selectedCustomer}</span> / <span>{getFolderName()}</span>
          </div>
        )}
      </div>

      <div className="form-screen-footer form-action-footer">
        <div className="form-action-grid">
          <button
            type="button"
            onClick={onOpenCamera}
            disabled={!canUpload || extracting}
            className="form-action-btn form-action-camera"
          >
            <span className="form-action-icon">📷</span>
            <span className="form-action-title">Open Camera</span>
            <span className="form-action-sub">Take photos &amp; videos</span>
          </button>

          <label className={`form-action-btn form-action-phone ${!canUpload || extracting ? 'disabled' : ''}`}>
            <span className="form-action-icon">🖼️</span>
            <span className="form-action-title">Upload From Phone</span>
            <span className="form-action-sub">Photos &amp; videos</span>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handlePhoneFiles}
              disabled={!canUpload || extracting}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <button
          type="button"
          onClick={onReviewUploads}
          className="form-action-btn form-action-review"
        >
          <span className="form-action-icon">☁️</span>
          <span className="form-action-review-text">
            <span className="form-action-title">Review Uploads</span>
            <span className="form-action-sub">View, manage &amp; finish</span>
          </span>
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
