import { useRef, useState, useEffect } from 'react';

export default function Camera({ customer, address, unit, onDone, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [photos, setPhotos] = useState([]);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(blob => {
      const newPhoto = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
      setPhotos(prev => [...prev, newPhoto]);
    }, 'image/jpeg', 0.9);
  };

  const handleDone = () => {
    stopCamera();
    onDone(photos);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#000'
    }}>
      {/* Video */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#000' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* Photo count */}
      {photos.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          background: 'rgba(0,136,0,0.9)',
          color: '#fff',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: '600'
        }}>
          📸 {photos.length} photo{photos.length > 1 ? 's' : ''}
        </div>
      )}

      {/* Controls */}
      <div style={{
        padding: '16px',
        background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.8) 100%)',
        display: 'flex',
        gap: '12px',
        justifyContent: 'center'
      }}>
        <button
          onClick={capturePhoto}
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#008800',
            border: '3px solid #00FF00',
            cursor: 'pointer'
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
            cursor: 'pointer'
          }}
        >
          Done
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '12px 20px',
            background: '#333',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
