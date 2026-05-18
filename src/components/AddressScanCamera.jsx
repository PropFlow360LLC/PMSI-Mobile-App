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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.95)',
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
          color: '#7aaad8',
          fontSize: '14px',
          textAlign: 'center',
        }}
      >
        Point at address or scope document
      </div>

      <div className="camera-preview" style={{ flex: 1 }}>
        {error ? (
          <div style={{ padding: '24px', color: '#e53e3e', textAlign: 'center' }}>{error}</div>
        ) : (
          <video ref={videoRef} autoPlay playsInline className="camera-video" />
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <div className="camera-bottom-shade" aria-hidden="true" />
        <div
          className="camera-controls"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)', padding: 0 }}
        >
          <button
            type="button"
            onClick={capture}
            disabled={!ready || capturing || !!error}
            className="camera-action-btn camera-done-btn"
            style={{
              opacity: ready && !capturing ? 1 : 0.5,
              cursor: ready && !capturing ? 'pointer' : 'not-allowed',
              minWidth: '120px',
            }}
          >
            {capturing ? 'Capturing…' : 'Capture'}
          </button>
          <button type="button" onClick={onCancel} className="camera-action-btn camera-cancel-btn">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
