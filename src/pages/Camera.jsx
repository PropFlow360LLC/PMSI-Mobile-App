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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#000',
    }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#000' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {photos.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              right: '16px',
              background: 'rgba(0,0,0,0.75)',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
            }}
          >
            {uploadedCount} uploaded
            {pendingCount > 0 && ` · ${pendingCount} uploading`}
            {queuedCount > 0 && ` · ${queuedCount} queued`}
          </div>
        )}
      </div>

      {photos.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '8px 12px',
            overflowX: 'auto',
            background: '#111',
            borderTop: '1px solid #333',
          }}
        >
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

      <div
        style={{
          padding: '16px',
          background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.8) 100%)',
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <button
          onClick={capturePhoto}
          disabled={capturing}
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: capturing ? '#004400' : '#008800',
            border: '3px solid #00FF00',
            cursor: capturing ? 'not-allowed' : 'pointer',
            opacity: capturing ? 0.6 : 1,
          }}
        />
        <button
          onClick={handleDone}
          style={{
            padding: '12px 20px',
            background: '#00FF00',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Done
        </button>
        <button
          onClick={() => {
            stopCamera();
            onCancel();
          }}
          style={{
            padding: '12px 20px',
            background: '#333',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
