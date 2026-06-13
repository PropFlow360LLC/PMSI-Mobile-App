import { useRef, useState, useEffect } from 'react';

export default function AddressScanCamera({ onCapture, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let stream;
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setReady(true);
        }
      } catch (err) {
        setError('Camera access denied or unavailable');
        console.error(err);
      }
    };
    start();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || capturing) return;

    setCapturing(true);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.9);
    });

    const file = new File([blob], `address_scan_${Date.now()}.jpg`, { type: 'image/jpeg' });
    onCapture(file);
  };

  return (
    <div className="address-scan-overlay">
      <div className="address-scan-header">
        Point at address or scope document
      </div>

      <div className="camera-preview address-scan-preview">
        {error ? (
          <div style={{ padding: '24px', color: '#e53e3e', textAlign: 'center' }}>{error}</div>
        ) : (
          <video ref={videoRef} autoPlay playsInline className="camera-video" />
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <div className="address-scan-shade" aria-hidden="true" />
        <div className="address-scan-controls">
          <button
            type="button"
            onClick={capture}
            disabled={!ready || capturing || !!error}
            className="address-scan-capture-btn"
          >
            {capturing ? 'Capturing…' : 'Capture'}
          </button>
          <button type="button" onClick={onCancel} className="address-scan-cancel-btn">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
