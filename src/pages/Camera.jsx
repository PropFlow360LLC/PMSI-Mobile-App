import { useRef, useState, useEffect } from 'react';

const STATUS_LABEL = {
  uploading: 'Uploading…',
  uploaded: 'Uploaded',
  failed: 'Failed',
  queued: 'Queued',
};

const STATUS_COLOR = {
  uploading: '#fbbf24',
  uploaded: '#00FF00',
  failed: '#e53e3e',
  queued: '#fbbf24',
};

const CONTROLS_BOTTOM = 'calc(env(safe-area-inset-bottom, 0px) + 96px)';
const THUMBS_BOTTOM = 'calc(env(safe-area-inset-bottom, 0px) + 172px)';

export default function Camera({ onUploadPhoto, onDone, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [photos, setPhotos] = useState([]);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera error:', err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    }
  };

  const updatePhoto = (id, updates) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || capturing) return;

    setCapturing(true);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.9);
    });

    const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
    const id = `capture_${Date.now()}`;
    const previewUrl = URL.createObjectURL(file);

    const entry = { id, file, previewUrl, status: 'uploading' };
    setPhotos((prev) => [...prev, entry]);

    try {
      const result = await onUploadPhoto(file);
      if (result.success) {
        updatePhoto(id, { status: 'uploaded' });
      } else if (result.queued) {
        updatePhoto(id, { status: 'queued' });
      } else {
        updatePhoto(id, { status: 'failed' });
      }
    } catch {
      updatePhoto(id, { status: 'failed' });
    } finally {
      setCapturing(false);
    }
  };

  const handleDone = () => {
    stopCamera();
    onDone(photos);
  };

  const uploadedCount = photos.filter((p) => p.status === 'uploaded').length;
  const pendingCount = photos.filter((p) => p.status === 'uploading').length;
  const queuedCount = photos.filter((p) => p.status === 'queued' || p.status === 'failed').length;

  return (
    <div className="camera-screen">
      <div className="camera-preview">
        <video ref={videoRef} autoPlay playsInline className="camera-video" />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <div className="camera-bottom-shade" aria-hidden="true" />

        {photos.length > 0 && (
          <div
            className="camera-status-badge"
            style={{ top: 'max(16px, env(safe-area-inset-top, 0px))' }}
          >
            {uploadedCount} uploaded
            {pendingCount > 0 && ` · ${pendingCount} uploading`}
            {queuedCount > 0 && ` · ${queuedCount} queued`}
          </div>
        )}

        {photos.length > 0 && (
          <div className="camera-thumbs" style={{ bottom: THUMBS_BOTTOM }}>
            {photos.map((photo) => (
              <div key={photo.id} style={{ position: 'relative', flexShrink: 0 }}>
                <img
                  src={photo.previewUrl}
                  alt=""
                  style={{
                    width: '64px',
                    height: '64px',
                    objectFit: 'cover',
                    borderRadius: '6px',
                    border: `2px solid ${STATUS_COLOR[photo.status] || '#555'}`,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'rgba(0,0,0,0.8)',
                    color: STATUS_COLOR[photo.status],
                    fontSize: '9px',
                    textAlign: 'center',
                    padding: '2px',
                    borderRadius: '0 0 4px 4px',
                  }}
                >
                  {STATUS_LABEL[photo.status] || photo.status}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="camera-controls" style={{ bottom: CONTROLS_BOTTOM }}>
          <button
            type="button"
            onClick={capturePhoto}
            disabled={capturing}
            aria-label="Capture photo"
            className="camera-capture-btn"
            style={{
              opacity: capturing ? 0.6 : 1,
              cursor: capturing ? 'not-allowed' : 'pointer',
              background: capturing ? '#004400' : '#008800',
            }}
          />
          <button type="button" onClick={handleDone} className="camera-action-btn camera-done-btn">
            Done
          </button>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onCancel();
            }}
            className="camera-action-btn camera-cancel-btn"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
